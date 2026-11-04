import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WebrtcSenal {
  id: string;
  de: string;
  para: string;
  tipo: string;
  peerId?: string;
  targetPeerId?: string;
  data?: any;
  timestamp: string;
}

const WEBRTC_BROADCAST_CHANNEL = 'webrtc_teleconsulta_canal_v2';

@Injectable({
  providedIn: 'root'
})
export class WebrtcTeleconsultaService {
  private readonly http = inject(HttpClient);

  // Streams y estados reactivos
  readonly streamLocal = signal<MediaStream | null>(null);
  readonly streamRemoto = signal<MediaStream | null>(null);
  readonly frameRemotoUrl = signal<string | null>(null);
  readonly p2pNativoConectado = signal<boolean>(false);
  readonly videoNativoDecodificando = signal<boolean>(false);
  readonly hayVideoRemoto = signal<boolean>(false);
  readonly microfonoRemotoActivo = signal<boolean>(true);
  readonly pantallaRemotaActiva = signal<boolean>(false);
  readonly conexionEstablecida = signal<boolean>(false);
  readonly consultaFinalizadaPorRemoto = signal<boolean>(false);

  private peerConnection?: RTCPeerConnection;
  private streamLocalActual?: MediaStream;
  private streamPantallaActual?: MediaStream;
  private idCitaActual: number | string = 42;
  private miRol: 'DOCTOR' | 'PACIENTE' = 'DOCTOR';
  private miPeerId = '';
  private ultimoOfferPeerIdProcesado = '';
  private ultimoJoinPeerIdAtendido = '';
  private camaraLocalActiva = true;
  private microfonoLocalActivo = true;

  private temporizadorSenales?: any;
  private temporizadorReintento?: any;
  private temporizadorRelayVideo?: any;
  private videoCapturadorRelay?: HTMLVideoElement;
  private canvasCapturadorRelay?: HTMLCanvasElement;
  private canvasVirtualDom?: HTMLCanvasElement;
  private audioRemotoEl?: HTMLAudioElement;
  private animacionVirtualId?: number;
  private canalLocal?: BroadcastChannel;
  private desbloqueoAudioRegistrado = false;

  private senalesProcesadas = new Set<string>();
  private candidatosPendientes: RTCIceCandidateInit[] = [];
  private pistasRemotas = new Map<string, MediaStreamTrack>();
  private ultimoHashPistasRemotas = '';
  private ultimoFrameRecibidoTs = 0;
  private negociando = false;

  private readonly iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  constructor() {
    this.inicializarCanalLocal();
    this.registrarDesbloqueoAudioInteractivo();
  }

  private inicializarCanalLocal(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.canalLocal = new BroadcastChannel(WEBRTC_BROADCAST_CHANNEL);
        this.canalLocal.onmessage = (event) => {
          const senal: WebrtcSenal = event.data;
          if (senal && senal.para === this.miRol) {
            this.manejarSenalEntrante(senal);
          }
        };
      } catch {}
    }
  }

  private registrarDesbloqueoAudioInteractivo(): void {
    if (typeof document === 'undefined' || this.desbloqueoAudioRegistrado) return;
    this.desbloqueoAudioRegistrado = true;

    const desbloquear = () => {
      if (this.audioRemotoEl && this.audioRemotoEl.srcObject) {
        this.audioRemotoEl.muted = !this.microfonoRemotoActivo();
        this.audioRemotoEl.volume = 1.0;
        this.audioRemotoEl.play().catch(() => {});
      }
      if (this.videoCapturadorRelay && this.videoCapturadorRelay.srcObject) {
        this.videoCapturadorRelay.play().catch(() => {});
      }
    };

    document.addEventListener('click', desbloquear, { passive: true });
    document.addEventListener('touchstart', desbloquear, { passive: true });
  }

  marcarVideoNativoListo(event: Event): void {
    const video = event?.target as HTMLVideoElement | null;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      this.videoNativoDecodificando.set(true);
      this.hayVideoRemoto.set(true);
      this.conexionEstablecida.set(true);
    }
  }

  /**
   * Obtiene cámara y micrófono físicos con cancelación de eco acústico (AEC) y supresión de ruido.
   */
  async crearStreamCamara(iniciales: string, nombre: string, rol: 'DOCTOR' | 'PACIENTE'): Promise<MediaStream> {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      channelCount: 1
    };

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
          },
          audio: audioConstraints
        });
        this.aplicarCancelacionEcoPistas(stream);
        this.streamLocalActual = stream;
        this.streamLocal.set(stream);
        return stream;
      } catch {}

      try {
        const streamGenerico = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: audioConstraints
        });
        this.aplicarCancelacionEcoPistas(streamGenerico);
        this.streamLocalActual = streamGenerico;
        this.streamLocal.set(streamGenerico);
        return streamGenerico;
      } catch (err) {
        console.warn('Cámara ocupada o restringida, intentando micrófono real + cámara virtual:', err);
      }

      let audioStreamReal: MediaStream | null = null;
      try {
        audioStreamReal = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: audioConstraints
        });
        this.aplicarCancelacionEcoPistas(audioStreamReal);
      } catch {
        audioStreamReal = null;
      }

      if (!audioStreamReal) {
        try {
          const soloVideo = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
          this.agregarPistaAudioSilenciosa(soloVideo);
          this.streamLocalActual = soloVideo;
          this.streamLocal.set(soloVideo);
          return soloVideo;
        } catch {}
      }

      const virtualStream = this.crearStreamVirtual(iniciales, nombre, rol, audioStreamReal);
      this.streamLocalActual = virtualStream;
      this.streamLocal.set(virtualStream);
      return virtualStream;
    }

    const fallback = this.crearStreamVirtual(iniciales, nombre, rol, null);
    this.streamLocalActual = fallback;
    this.streamLocal.set(fallback);
    return fallback;
  }

  private aplicarCancelacionEcoPistas(stream: MediaStream): void {
    stream.getAudioTracks().forEach((track) => {
      try {
        track.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }).catch(() => {});
      } catch {}
    });
  }

  private agregarPistaAudioSilenciosa(stream: MediaStream): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0;
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      const audioTrack = dst.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch {}
  }

  private crearStreamVirtual(
    iniciales: string,
    nombre: string,
    rol: 'DOCTOR' | 'PACIENTE',
    audioStreamReal: MediaStream | null
  ): MediaStream {
    if (this.animacionVirtualId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animacionVirtualId);
    }

    if (!this.canvasVirtualDom) {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      c.style.position = 'fixed';
      c.style.bottom = '0';
      c.style.right = '0';
      c.style.width = '1px';
      c.style.height = '1px';
      c.style.opacity = '0.01';
      c.style.pointerEvents = 'none';
      c.style.zIndex = '-1';
      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(c);
      }
      this.canvasVirtualDom = c;
    }

    const canvas = this.canvasVirtualDom;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    const dibujarFrame = () => {
      frame++;
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      if (rol === 'DOCTOR') {
        grad.addColorStop(0, '#0b192c');
        grad.addColorStop(1, '#1e3a8a');
      } else {
        grad.addColorStop(0, '#0c1322');
        grad.addColorStop(1, '#064e3b');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      const pulse = Math.sin(frame * 0.08) * 6;
      const pulseOuter = Math.cos(frame * 0.05) * 10;

      ctx.beginPath();
      ctx.arc(320, 200, 78 + pulseOuter, 0, Math.PI * 2);
      ctx.strokeStyle = rol === 'DOCTOR' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(320, 200, 62 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = rol === 'DOCTOR' ? '#2563eb' : '#059669';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(iniciales || (rol === 'DOCTOR' ? 'DR' : 'PA'), 320, 200);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(nombre, 320, 325);

      const horaViva = new Date().toLocaleTimeString();
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(195, 365, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(
        `${rol === 'DOCTOR' ? 'SEÑAL DOCTOR EN VIVO' : 'SEÑAL PACIENTE EN VIVO'} · ${horaViva}`,
        335,
        365
      );

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animacionVirtualId = requestAnimationFrame(dibujarFrame);
      }
    };
    dibujarFrame();

    const compositeStream = canvas.captureStream(24);

    if (audioStreamReal && audioStreamReal.getAudioTracks().length > 0) {
      audioStreamReal.getAudioTracks().forEach((track) => {
        compositeStream.addTrack(track);
      });
    } else {
      this.agregarPistaAudioSilenciosa(compositeStream);
    }

    return compositeStream;
  }

  /**
   * Activa o silencia el micrófono local en tiempo real y avisa al otro participante
   */
  setMicrofonoActivo(activo: boolean): void {
    this.microfonoLocalActivo = activo;
    if (this.streamLocalActual) {
      this.streamLocalActual.getAudioTracks().forEach((track) => {
        track.enabled = activo;
      });
    }
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = activo;
        }
      });
    }
    const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
    this.enviarSenal(this.idCitaActual, this.miRol, otroRol, 'MICROFONO_ESTADO', { activo });
  }

  /**
   * Enciende o apaga el envío de video de la cámara sin cortar la conexión WebRTC ni el audio
   */
  setCamaraActiva(activa: boolean): void {
    this.camaraLocalActiva = activa;
    if (this.streamLocalActual) {
      this.streamLocalActual.getVideoTracks().forEach((track) => {
        track.enabled = activa;
      });
    }
    if (this.peerConnection && !this.streamPantallaActual) {
      this.peerConnection.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          sender.track.enabled = activa;
        }
      });
    }
    const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
    this.enviarSenal(this.idCitaActual, this.miRol, otroRol, 'CAMARA_ESTADO', { activa });
  }

  /**
   * Notifica al otro participante que la consulta ha sido finalizada por el médico
   */
  async notificarFinConsulta(): Promise<void> {
    const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
    await this.enviarSenal(this.idCitaActual, this.miRol, otroRol, 'FINALIZAR_CONSULTA', {
      finalizada: true
    });
  }

  /**
   * Inicializa la conexión P2P bidireccional (Audio + Video + Pantalla) entre Doctor y Paciente
   */
  async iniciarP2P(idCita: string | number, rol: 'DOCTOR' | 'PACIENTE', streamLocal: MediaStream): Promise<void> {
    this.detenerTemporizadores();
    this.cerrarPeerConnectionActual();

    this.idCitaActual = idCita || 42;
    this.miRol = rol;
    this.miPeerId = `${rol}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.ultimoOfferPeerIdProcesado = '';
    this.ultimoJoinPeerIdAtendido = '';
    this.ultimoHashPistasRemotas = '';
    this.ultimoFrameRecibidoTs = 0;
    this.streamLocalActual = streamLocal;
    this.streamLocal.set(streamLocal);
    this.streamRemoto.set(null);
    this.frameRemotoUrl.set(null);
    this.hayVideoRemoto.set(false);
    this.pantallaRemotaActiva.set(false);
    this.conexionEstablecida.set(false);
    this.senalesProcesadas.clear();
    this.candidatosPendientes = [];
    this.pistasRemotas.clear();
    this.p2pNativoConectado.set(false);
    this.videoNativoDecodificando.set(false);
    this.consultaFinalizadaPorRemoto.set(false);

    this.asegurarElementoAudioRemoto();
    this.construirPeerConnection(streamLocal);

    this.iniciarSondeoSenales();
    this.iniciarRelayVideo();

    if (this.miRol === 'DOCTOR') {
      await this.crearYEnviarOferta();
    } else {
      await this.enviarSenal(this.idCitaActual, 'PACIENTE', 'DOCTOR', 'JOIN', {
        rol: 'PACIENTE',
        peerId: this.miPeerId
      });
    }

    this.temporizadorReintento = setInterval(async () => {
      // Si el otro participante dejó de enviar frames y no hay conexión P2P activa, limpiar imagen congelada
      if (!this.p2pNativoConectado() && this.frameRemotoUrl() && this.ultimoFrameRecibidoTs > 0) {
        if (Date.now() - this.ultimoFrameRecibidoTs > 4500) {
          this.frameRemotoUrl.set(null);
          this.hayVideoRemoto.set(false);
          this.conexionEstablecida.set(false);
        }
      }

      if (this.p2pNativoConectado() || !this.peerConnection) return;

      const state = this.peerConnection.connectionState;
      const iceState = this.peerConnection.iceConnectionState;
      if (state === 'connected' || iceState === 'connected' || iceState === 'completed') {
        this.p2pNativoConectado.set(true);
        this.conexionEstablecida.set(true);
        return;
      }

      if (this.miRol === 'PACIENTE') {
        await this.enviarSenal(this.idCitaActual, 'PACIENTE', 'DOCTOR', 'JOIN', {
          rol: 'PACIENTE',
          peerId: this.miPeerId
        });
      } else if (this.miRol === 'DOCTOR' && (state === 'failed' || state === 'disconnected')) {
        this.construirPeerConnection(this.streamLocalActual!);
        await this.crearYEnviarOferta();
      }
    }, 3500);
  }

  private asegurarElementoAudioRemoto(): void {
    if (typeof document === 'undefined') return;
    if (!this.audioRemotoEl) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.style.display = 'none';
      if (document.body) {
        document.body.appendChild(audio);
      }
      this.audioRemotoEl = audio;
    }
  }

  private iniciarRelayVideo(): void {
    if (typeof document === 'undefined') return;

    if (!this.videoCapturadorRelay) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
      v.style.position = 'fixed';
      v.style.bottom = '0';
      v.style.left = '0';
      v.style.width = '1px';
      v.style.height = '1px';
      v.style.opacity = '0.01';
      v.style.pointerEvents = 'none';
      v.style.zIndex = '-1';
      if (document.body) {
        document.body.appendChild(v);
      }
      this.videoCapturadorRelay = v;
    }
    if (!this.canvasCapturadorRelay) {
      this.canvasCapturadorRelay = document.createElement('canvas');
      this.canvasCapturadorRelay.width = 320;
      this.canvasCapturadorRelay.height = 240;
    }

    this.actualizarFuenteVideoRelay();

    if (this.temporizadorRelayVideo) clearInterval(this.temporizadorRelayVideo);
    this.temporizadorRelayVideo = setInterval(() => {
      if (!this.camaraLocalActiva && !this.streamPantallaActual) return;
      if (!this.canvasCapturadorRelay) return;

      try {
        const ctx = this.canvasCapturadorRelay.getContext('2d');
        if (!ctx) return;

        let dibujado = false;
        if (this.videoCapturadorRelay && this.videoCapturadorRelay.readyState >= 2 && this.videoCapturadorRelay.videoWidth > 0) {
          ctx.drawImage(this.videoCapturadorRelay, 0, 0, 320, 240);
          dibujado = true;
        } else if (this.canvasVirtualDom) {
          ctx.drawImage(this.canvasVirtualDom, 0, 0, 320, 240);
          dibujado = true;
        } else if (this.videoCapturadorRelay) {
          this.videoCapturadorRelay.play().catch(() => {});
        }

        if (dibujado) {
          const dataUrl = this.canvasCapturadorRelay.toDataURL('image/jpeg', 0.45);
          if (dataUrl && dataUrl.length > 200) {
            const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
            this.enviarSenalSoloBackend(this.idCitaActual, this.miRol, otroRol, 'VIDEO_FRAME', {
              frame: dataUrl
            });
          }
        }
      } catch {}
    }, 500);
  }

  private actualizarFuenteVideoRelay(): void {
    if (!this.videoCapturadorRelay) return;
    const fuente = this.streamPantallaActual || this.streamLocalActual || null;
    if (this.videoCapturadorRelay.srcObject !== fuente) {
      this.videoCapturadorRelay.srcObject = fuente;
      if (fuente) {
        this.videoCapturadorRelay.muted = true;
        this.videoCapturadorRelay.play().catch(() => {});
      }
    }
  }

  private construirPeerConnection(streamLocal: MediaStream): void {
    this.cerrarPeerConnectionActual();
    this.candidatosPendientes = [];
    this.pistasRemotas.clear();
    this.ultimoHashPistasRemotas = '';
    this.videoNativoDecodificando.set(false);

    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnection = pc;

    streamLocal.getTracks().forEach((track) => {
      pc.addTrack(track, streamLocal);
    });

    if (this.streamPantallaActual) {
      const screenTrack = this.streamPantallaActual.getVideoTracks()[0];
      const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (screenTrack && videoSender) {
        videoSender.replaceTrack(screenTrack).catch(() => {});
      }
    }

    pc.ontrack = (event) => {
      if (event.track) {
        this.pistasRemotas.set(event.track.kind, event.track);
      }
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          this.pistasRemotas.set(t.kind, t);
        });
      }

      const todasLasPistas = Array.from(this.pistasRemotas.values());
      if (todasLasPistas.length > 0) {
        const nuevoHash = todasLasPistas.map((t) => `${t.kind}:${t.id}`).sort().join('|');
        if (nuevoHash !== this.ultimoHashPistasRemotas) {
          this.ultimoHashPistasRemotas = nuevoHash;
          const nuevoStreamRemoto = new MediaStream(todasLasPistas);
          this.streamRemoto.set(nuevoStreamRemoto);

          // Reproducir audio remoto en UNA única instancia de audio con control de eco
          const pistasAudio = todasLasPistas.filter((t) => t.kind === 'audio');
          if (pistasAudio.length > 0 && this.audioRemotoEl) {
            this.audioRemotoEl.srcObject = new MediaStream(pistasAudio);
            this.audioRemotoEl.muted = !this.microfonoRemotoActivo();
            this.audioRemotoEl.volume = 1.0;
            this.audioRemotoEl.play().catch(() => {});
          }
        }
        this.hayVideoRemoto.set(true);
        this.conexionEstablecida.set(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const st = this.peerConnection.connectionState;
      if (st === 'connected') {
        this.p2pNativoConectado.set(true);
        this.conexionEstablecida.set(true);
      } else if (st === 'failed' || st === 'closed') {
        this.p2pNativoConectado.set(false);
        this.videoNativoDecodificando.set(false);
        if (!this.frameRemotoUrl()) {
          this.conexionEstablecida.set(false);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const ice = this.peerConnection.iceConnectionState;
      if (ice === 'connected' || ice === 'completed') {
        this.p2pNativoConectado.set(true);
        this.conexionEstablecida.set(true);
      } else if (ice === 'failed' || ice === 'disconnected' || ice === 'closed') {
        this.p2pNativoConectado.set(false);
        this.videoNativoDecodificando.set(false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
        this.enviarSenal(
          this.idCitaActual,
          this.miRol,
          otroRol,
          'CANDIDATE',
          event.candidate.toJSON()
        );
      }
    };
  }

  private async crearYEnviarOferta(targetPeerId?: string): Promise<void> {
    if (!this.peerConnection || this.miRol !== 'DOCTOR' || this.negociando) return;
    this.negociando = true;
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.peerConnection.setLocalDescription(offer);
      await this.enviarSenal(
        this.idCitaActual,
        'DOCTOR',
        'PACIENTE',
        'OFFER',
        {
          sdp: offer.sdp,
          type: offer.type
        },
        targetPeerId
      );
    } catch (err) {
      console.warn('Error al crear oferta WebRTC:', err);
    } finally {
      this.negociando = false;
    }
  }

  private iniciarSondeoSenales(): void {
    if (this.temporizadorSenales) clearInterval(this.temporizadorSenales);
    this.procesarSenales();
    this.temporizadorSenales = setInterval(() => {
      this.procesarSenales();
    }, 450);
  }

  private procesarSenales(): void {
    if (!this.idCitaActual || !this.peerConnection) return;

    this.http
      .get<WebrtcSenal[]>(`${environment.apiUrl}/citas/${this.idCitaActual}/webrtc/signal?para=${this.miRol}`)
      .subscribe({
        next: async (senales) => {
          if (!senales || !Array.isArray(senales)) return;
          for (const s of senales) {
            await this.manejarSenalEntrante(s);
          }
        },
        error: () => {}
      });
  }

  private async manejarSenalEntrante(s: WebrtcSenal): Promise<void> {
    if (!s || !s.id) return;
    if (this.senalesProcesadas.has(s.id)) return;
    this.senalesProcesadas.add(s.id);

    try {
      if (s.tipo === 'FINALIZAR_CONSULTA') {
        if (s.timestamp) {
          const edadMs = Date.now() - new Date(s.timestamp).getTime();
          if (!Number.isNaN(edadMs) && edadMs > 3500) {
            return;
          }
        }
        this.consultaFinalizadaPorRemoto.set(true);
        return;
      }

      if (!this.peerConnection) return;

      if (s.tipo === 'VIDEO_FRAME' && s.data?.frame) {
        if (s.timestamp) {
          const edadMs = Date.now() - new Date(s.timestamp).getTime();
          if (!Number.isNaN(edadMs) && edadMs > 4500) {
            return;
          }
        }
        this.ultimoFrameRecibidoTs = Date.now();
        this.frameRemotoUrl.set(s.data.frame);
        this.hayVideoRemoto.set(true);
        this.conexionEstablecida.set(true);
        return;
      }

      if (s.tipo === 'JOIN' && this.miRol === 'DOCTOR') {
        const joinPeerId = s.peerId || s.data?.peerId || s.id;
        if (joinPeerId !== this.ultimoJoinPeerIdAtendido || !this.p2pNativoConectado()) {
          this.ultimoJoinPeerIdAtendido = joinPeerId;
          if (this.streamLocalActual) {
            this.miPeerId = `DOCTOR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            this.construirPeerConnection(this.streamLocalActual);
            await this.crearYEnviarOferta(joinPeerId);
          }
        }
      } else if (s.tipo === 'OFFER' && this.miRol === 'PACIENTE' && s.data) {
        const offerPeerId = s.peerId || s.id;
        if (
          offerPeerId === this.ultimoOfferPeerIdProcesado &&
          this.peerConnection.signalingState === 'stable' &&
          this.p2pNativoConectado()
        ) {
          return;
        }
        this.ultimoOfferPeerIdProcesado = offerPeerId;

        if (this.peerConnection.signalingState !== 'stable' || this.peerConnection.remoteDescription) {
          if (this.streamLocalActual) {
            this.construirPeerConnection(this.streamLocalActual);
          }
        }

        await this.peerConnection!.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: s.data.sdp })
        );
        await this.vaciarCandidatosPendientes();

        const answer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(answer);

        await this.enviarSenal(
          this.idCitaActual,
          'PACIENTE',
          'DOCTOR',
          'ANSWER',
          {
            sdp: answer.sdp,
            type: answer.type
          },
          s.peerId
        );
      } else if (s.tipo === 'ANSWER' && this.miRol === 'DOCTOR' && s.data) {
        if (s.targetPeerId && s.targetPeerId !== this.miPeerId) {
          return;
        }
        if (this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: s.data.sdp })
          );
          await this.vaciarCandidatosPendientes();
          this.conexionEstablecida.set(true);
        }
      } else if (s.tipo === 'CANDIDATE' && s.data) {
        if (s.targetPeerId && s.targetPeerId !== this.miPeerId) {
          return;
        }
        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(s.data));
          } catch {}
        } else {
          this.candidatosPendientes.push(s.data);
        }
      } else if (s.tipo === 'CAMARA_ESTADO' && s.data) {
        const activa = Boolean(s.data.activa);
        this.hayVideoRemoto.set(activa);
        if (!activa) {
          this.frameRemotoUrl.set(null);
        }
      } else if (s.tipo === 'MICROFONO_ESTADO' && s.data) {
        const activo = Boolean(s.data.activo);
        this.microfonoRemotoActivo.set(activo);
        if (this.audioRemotoEl) {
          this.audioRemotoEl.muted = !activo;
        }
      } else if (s.tipo === 'PANTALLA_COMPARTIDA') {
        this.pantallaRemotaActiva.set(true);
        this.hayVideoRemoto.set(true);
      } else if (s.tipo === 'DETENER_PANTALLA') {
        this.pantallaRemotaActiva.set(false);
      }
    } catch (e) {
      console.warn('Error al procesar señal WebRTC:', s.tipo, e);
    }
  }

  private async vaciarCandidatosPendientes(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const pendientes = [...this.candidatosPendientes];
    this.candidatosPendientes = [];
    for (const cand of pendientes) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch {}
    }
  }

  private async enviarSenalSoloBackend(
    idCita: string | number,
    de: string,
    para: string,
    tipo: string,
    data: any
  ): Promise<void> {
    try {
      const resp = await firstValueFrom(
        this.http.post<WebrtcSenal>(`${environment.apiUrl}/citas/${idCita}/webrtc/signal`, {
          de,
          para,
          tipo,
          peerId: this.miPeerId,
          data
        })
      );
      if (resp && resp.id) {
        this.senalesProcesadas.add(resp.id);
      }
    } catch {}
  }

  private async enviarSenal(
    idCita: string | number,
    de: string,
    para: string,
    tipo: string,
    data: any,
    targetPeerId?: string
  ): Promise<void> {
    const idLocal = `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const senalLocal: WebrtcSenal = {
      id: idLocal,
      de,
      para,
      tipo,
      peerId: this.miPeerId,
      targetPeerId,
      data,
      timestamp: new Date().toISOString()
    };

    if (this.canalLocal) {
      try {
        this.canalLocal.postMessage(senalLocal);
      } catch {}
    }

    try {
      const resp = await firstValueFrom(
        this.http.post<WebrtcSenal>(`${environment.apiUrl}/citas/${idCita}/webrtc/signal`, {
          de,
          para,
          tipo,
          peerId: this.miPeerId,
          targetPeerId,
          data
        })
      );
      if (resp && resp.id) {
        this.senalesProcesadas.add(resp.id);
      }
    } catch {}
  }

  /**
   * Reemplaza la pista de video enviada por la pantalla compartida en vivo
   */
  compartirPantalla(streamPantalla: MediaStream): void {
    this.streamPantallaActual = streamPantalla;
    this.actualizarFuenteVideoRelay();
    if (!this.peerConnection) return;
    const screenTrack = streamPantalla.getVideoTracks()[0];
    if (!screenTrack) return;

    const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(screenTrack).catch(() => {});
    }

    const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
    this.enviarSenal(this.idCitaActual, this.miRol, otroRol, 'PANTALLA_COMPARTIDA', { activa: true });
  }

  /**
   * Restaura la pista de video de la cámara al detener la pantalla compartida
   */
  detenerCompartirPantalla(streamCamara?: MediaStream): void {
    this.streamPantallaActual = undefined;
    this.actualizarFuenteVideoRelay();
    const camStream = streamCamara || this.streamLocalActual;
    if (!this.peerConnection || !camStream) return;

    const cameraTrack = camStream.getVideoTracks()[0];
    if (!cameraTrack) return;

    const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(cameraTrack).catch(() => {});
    }

    const otroRol = this.miRol === 'DOCTOR' ? 'PACIENTE' : 'DOCTOR';
    this.enviarSenal(this.idCitaActual, this.miRol, otroRol, 'DETENER_PANTALLA', { activa: false });
  }

  private detenerTemporizadores(): void {
    if (this.temporizadorSenales) {
      clearInterval(this.temporizadorSenales);
      this.temporizadorSenales = undefined;
    }
    if (this.temporizadorReintento) {
      clearInterval(this.temporizadorReintento);
      this.temporizadorReintento = undefined;
    }
    if (this.temporizadorRelayVideo) {
      clearInterval(this.temporizadorRelayVideo);
      this.temporizadorRelayVideo = undefined;
    }
  }

  private cerrarPeerConnectionActual(): void {
    if (this.peerConnection) {
      try {
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.close();
      } catch {}
      this.peerConnection = undefined;
    }
  }

  limpiarRemoto(): void {
    this.ultimoFrameRecibidoTs = 0;
    this.pistasRemotas.clear();
    this.ultimoHashPistasRemotas = '';
    if (this.audioRemotoEl) {
      this.audioRemotoEl.srcObject = null;
    }
    this.streamRemoto.set(null);
    this.frameRemotoUrl.set(null);
    this.p2pNativoConectado.set(false);
    this.videoNativoDecodificando.set(false);
    this.hayVideoRemoto.set(false);
    this.pantallaRemotaActiva.set(false);
    this.conexionEstablecida.set(false);
  }

  cerrarConexion(): void {
    this.detenerTemporizadores();
    this.cerrarPeerConnectionActual();
    if (this.animacionVirtualId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animacionVirtualId);
      this.animacionVirtualId = undefined;
    }
    if (this.videoCapturadorRelay) {
      this.videoCapturadorRelay.srcObject = null;
    }
    if (this.audioRemotoEl) {
      this.audioRemotoEl.srcObject = null;
    }
    this.streamLocalActual = undefined;
    this.streamPantallaActual = undefined;
    this.candidatosPendientes = [];
    this.pistasRemotas.clear();
    this.ultimoHashPistasRemotas = '';
    this.streamLocal.set(null);
    this.streamRemoto.set(null);
    this.frameRemotoUrl.set(null);
    this.p2pNativoConectado.set(false);
    this.videoNativoDecodificando.set(false);
    this.hayVideoRemoto.set(false);
    this.pantallaRemotaActiva.set(false);
    this.conexionEstablecida.set(false);
  }
}
