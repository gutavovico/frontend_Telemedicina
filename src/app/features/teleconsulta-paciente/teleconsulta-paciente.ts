import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatConsultaRealtimeService } from '../../core/services/chat-consulta-realtime.service';
import { WebrtcTeleconsultaService } from '../../core/services/webrtc-teleconsulta.service';

@Component({
  selector: 'app-teleconsulta-paciente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teleconsulta-paciente.html',
  styleUrls: ['./teleconsulta-paciente.css']
})
export class TeleconsultaPacienteComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);
  readonly chatService = inject(ChatConsultaRealtimeService);
  readonly webrtcService = inject(WebrtcTeleconsultaService);

  @ViewChild('videoPacienteLocal') videoPacienteLocalRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoPantallaCompartida') videoPantallaCompartidaRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoDoctorRemoto') videoDoctorRemotoRef?: ElementRef<HTMLVideoElement>;

  private cerrandoPorDoctor = false;
  private inicioVistaTs = Date.now();
  readonly enReunionActiva = signal<boolean>(false);

  constructor() {
    effect(() => {
      const finalizadaChat = this.chatService.consultaFinalizada();
      const finalizadaWebrtc = this.webrtcService.consultaFinalizadaPorRemoto();
      if ((finalizadaChat || finalizadaWebrtc) && !this.cerrandoPorDoctor) {
        // Ignorar señales residuales de cierre durante los primeros 2.5s al acabar de entrar a la sala
        if (Date.now() - this.inicioVistaTs < 2500) {
          this.chatService.consultaFinalizada.set(false);
          this.webrtcService.consultaFinalizadaPorRemoto.set(false);
          return;
        }
        this.cerrandoPorDoctor = true;
        this.cerrarSalaPorFinalizacionDelDoctor();
        return;
      }

      const streamRemoto = this.webrtcService.streamRemoto();
      const conectadoP2P = this.webrtcService.conexionEstablecida();
      const hayVideo = this.webrtcService.hayVideoRemoto();
      const docEnSala = this.doctorConectado();
      const pantallaLocal = this.compartiendoPantalla();

      // Si se establece conexión WebRTC o llega video/audio del doctor, marcar reunión activa
      if ((conectadoP2P || hayVideo || streamRemoto || docEnSala) && !this.enReunionActiva()) {
        this.enReunionActiva.set(true);
      }

      this.sincronizarElementosVideo(streamRemoto, pantallaLocal);
      setTimeout(() => this.sincronizarElementosVideo(streamRemoto, pantallaLocal), 80);
    });
  }

  private cerrarSalaPorFinalizacionDelDoctor(): void {
    this.detenerCamaraPaciente();
    this.detenerCompartirPantalla();
    this.detenerTemporizador();
    this.chatService.detenerPresenciaPaciente();
    this.chatService.consultaFinalizada.set(false);
    this.webrtcService.consultaFinalizadaPorRemoto.set(false);
    setTimeout(() => {
      alert('El médico ha finalizado la teleconsulta. Serás redirigido a tu sección de Recetas Médicas Digitales.');
      this.router.navigate(['/recetas']);
    }, 100);
  }

  readonly requiereHttpsMovil = signal<boolean>(
    typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
  );

  activarCamaraMicrofonoHttps(): void {
    if (typeof window === 'undefined') return;
    try {
      const local: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) local[k] = localStorage.getItem(k) || '';
      }
      const session: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k) session[k] = sessionStorage.getItem(k) || '';
      }
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ local, session }))));
      window.location.href = `https://${window.location.host}${window.location.pathname}${window.location.search}#sso=${payload}`;
    } catch {
      window.location.href = `https://${window.location.host}${window.location.pathname}${window.location.search}`;
    }
  }

  private sincronizarElementosVideo(streamRemoto: MediaStream | null, _pantallaLocal: boolean): void {
    const videoRemotoEl = this.videoDoctorRemotoRef?.nativeElement;
    if (videoRemotoEl && streamRemoto) {
      if (videoRemotoEl.srcObject !== streamRemoto) {
        videoRemotoEl.srcObject = streamRemoto;
      }
      videoRemotoEl.muted = true;
      videoRemotoEl.play().catch(() => {});
    }

    const videoLocalEl = this.videoPacienteLocalRef?.nativeElement;
    if (videoLocalEl && this.streamCamaraLocal && this.camaraActiva()) {
      if (videoLocalEl.srcObject !== this.streamCamaraLocal) {
        videoLocalEl.srcObject = this.streamCamaraLocal;
      }
      videoLocalEl.muted = true;
      videoLocalEl.play().catch(() => {});
    }
  }

  // Datos dinámicos de la consulta seleccionada
  readonly cita = signal({
    idCita: '42',
    titulo: 'Teleconsulta · Cardiología',
    medicoNombre: 'Dra. Lucía Rojas',
    medicoEspecialidad: 'Cardiología · Clínica Norte',
    medicoIniciales: 'LR',
    clinicaTag: 'Clínica Norte',
    horario: '10:30 - 11:00',
    fichaCodigo: 'Ficha CAR-014',
    duracionSegundos: 0, // Inicia en 00:00
    calidadRed: 'HD 1080p',
    cifrado: true,
    pacienteNombre: 'Ana Gutiérrez',
    pacienteIniciales: 'AG',
    posicionFila: 2,
    pacientesAntes: 1,
    tiempoEstimadoMin: 8
  });

  // Presencia del Doctor en tiempo real (Signal del servicio)
  readonly doctorConectado = this.chatService.doctorConectado;

  // Estados de periféricos y llamada
  readonly microfonoActivo = signal<boolean>(true);
  readonly camaraActiva = signal<boolean>(true);
  readonly compartiendoPantalla = signal<boolean>(false);
  readonly chatAbierto = signal<boolean>(true);

  // Chat en tiempo real
  readonly textoMensaje = signal<string>('');
  readonly mensajesChat = this.chatService.mensajes;

  private temporizador?: any;
  private streamCamaraLocal?: MediaStream;
  private streamPantalla?: MediaStream;

  extraerIniciales(nombre: string | null | undefined): string {
    if (!nombre) return 'DR';
    const limpio = nombre.replace(/^(Dr\(a\)\.?|Dr\.|Dra\.)\s*/i, '').trim();
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0] ? partes[0].substring(0, 2).toUpperCase() : 'DR';
  }

  ngOnInit(): void {
    this.inicioVistaTs = Date.now();
    this.cerrandoPorDoctor = false;
    this.chatService.consultaFinalizada.set(false);
    this.webrtcService.consultaFinalizadaPorRemoto.set(false);

    // 1. Obtener parámetros de la consulta seleccionada dinámicamente
    const qp = this.route.snapshot.queryParams;
    const params = this.route.snapshot.params;

    const usuario = this.authService.currentUser();
    const nombrePaciente = usuario ? `${usuario.nombres} ${usuario.apellidos || ''}`.trim() : 'Ana Gutiérrez';
    const inicialesPaciente = this.extraerIniciales(nombrePaciente) || 'AG';

    const medicoParam = qp['medico'] || 'Dra. Lucía Rojas';
    const especialidadParam = qp['especialidad'] || 'Cardiología';
    const clinicaParam = qp['clinica'] || 'Clínica Norte';
    const horarioParam = qp['horario'] || '10:30 - 11:00';
    const fichaParam = qp['ficha'] || 'Ficha CAR-014';
    const idCitaParam = qp['idCita'] || params['id'] || '42';

    this.cita.set({
      idCita: String(idCitaParam),
      titulo: `Teleconsulta · ${especialidadParam}`,
      medicoNombre: medicoParam,
      medicoEspecialidad: `${especialidadParam} · ${clinicaParam}`,
      medicoIniciales: this.extraerIniciales(medicoParam),
      clinicaTag: clinicaParam,
      horario: horarioParam,
      fichaCodigo: fichaParam,
      duracionSegundos: 0,
      calidadRed: 'HD 1080p',
      cifrado: true,
      pacienteNombre: nombrePaciente,
      pacienteIniciales: inicialesPaciente,
      posicionFila: 2,
      pacientesAntes: 1,
      tiempoEstimadoMin: 8
    });

    // 2. Inicializar sesión limpia de chat y sincronización con backend
    this.chatService.iniciarSesion(this.cita().idCita, this.cita().pacienteNombre);

    // 3. Registrar presencia del paciente y verificar si el doctor ya está en la sala
    this.chatService.iniciarPresenciaPaciente(this.cita().pacienteNombre);

    this.iniciarTemporizador();
    this.iniciarCamaraPaciente();
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    this.detenerCamaraPaciente();
    this.detenerCompartirPantalla();
    this.chatService.detenerPresenciaPaciente();
  }

  iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.temporizador = setInterval(() => {
      // El temporizador de la consulta avanza desde 00:00 cuando está en la reunión o el doctor está conectado
      if (this.enReunionActiva() || this.doctorConectado() || this.webrtcService.conexionEstablecida()) {
        this.cita.update((c) => ({ ...c, duracionSegundos: c.duracionSegundos + 1 }));
      }
    }, 1000);
  }

  detenerTemporizador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
    }
  }

  formatearTiempo(segundos: number): string {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  }

  alternarMicrofono(): void {
    const nuevoEstado = !this.microfonoActivo();
    this.microfonoActivo.set(nuevoEstado);
    this.webrtcService.setMicrofonoActivo(nuevoEstado);
  }

  alternarCamara(): void {
    const nuevoEstado = !this.camaraActiva();
    this.camaraActiva.set(nuevoEstado);
    this.webrtcService.setCamaraActiva(nuevoEstado);

    if (nuevoEstado) {
      setTimeout(() => {
        if (this.videoPacienteLocalRef?.nativeElement && this.streamCamaraLocal) {
          this.videoPacienteLocalRef.nativeElement.srcObject = this.streamCamaraLocal;
          this.videoPacienteLocalRef.nativeElement.muted = true;
          this.videoPacienteLocalRef.nativeElement.play().catch(() => {});
        }
      }, 60);
    }
  }

  async alternarCompartirPantalla(): Promise<void> {
    if (this.compartiendoPantalla()) {
      this.detenerCompartirPantalla();
    } else {
      await this.iniciarCompartirPantalla();
    }
  }

  async iniciarCompartirPantalla(): Promise<void> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        this.streamPantalla = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        this.compartiendoPantalla.set(true);

        setTimeout(() => {
          if (this.videoPantallaCompartidaRef?.nativeElement && this.streamPantalla) {
            this.videoPantallaCompartidaRef.nativeElement.srcObject = this.streamPantalla;
            this.videoPantallaCompartidaRef.nativeElement.play().catch(() => {});
          }
        }, 100);

        // Transmitir pantalla compartida al doctor en vivo mediante WebRTC
        this.webrtcService.compartirPantalla(this.streamPantalla);

        const videoTrack = this.streamPantalla.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            this.detenerCompartirPantalla();
          };
        }
      } else {
        alert('Tu navegador no soporta la función de compartir pantalla.');
      }
    } catch (err) {
      console.warn('Compartir pantalla cancelado por el usuario:', err);
      this.compartiendoPantalla.set(false);
    }
  }

  detenerCompartirPantalla(): void {
    if (this.streamPantalla) {
      this.streamPantalla.getTracks().forEach((track) => track.stop());
      this.streamPantalla = undefined;
    }
    this.compartiendoPantalla.set(false);
    if (this.streamCamaraLocal) {
      this.webrtcService.detenerCompartirPantalla(this.streamCamaraLocal);
    }
  }

  enviarMensaje(): void {
    const texto = this.textoMensaje().trim();
    if (!texto) return;

    const nombrePaciente = this.cita().pacienteNombre || 'Ana Gutiérrez';
    this.chatService.enviarMensaje(nombrePaciente, false, texto);
    this.textoMensaje.set('');
  }

  adjuntarArchivo(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const tamKb = Math.max(1, Math.round(file.size / 1024)) + ' KB';
        const tipo = file.name.split('.').pop()?.toUpperCase() || 'DOC';
        const nombrePaciente = this.cita().pacienteNombre || 'Ana Gutiérrez';
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          this.chatService.enviarMensaje(
            nombrePaciente,
            false,
            `Adjunto documento: ${file.name}`,
            file.name,
            tamKb,
            tipo,
            dataUrl
          );
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  conectarLlamadaDirecta(): void {
    this.cita.update((c) => ({ ...c, duracionSegundos: 0 }));
    this.enReunionActiva.set(true);
    this.chatService.doctorConectado.set(true);
    this.chatService.iniciarPresenciaPaciente(this.cita().pacienteNombre);
    setTimeout(() => {
      this.sincronizarElementosVideo(this.webrtcService.streamRemoto(), this.compartiendoPantalla());
    }, 80);
  }

  salirDeLaSala(): void {
    if (confirm('¿Desea salir de la videoconsulta? Se le redirigirá a su sección de Recetas Médicas Digitales.')) {
      this.detenerCamaraPaciente();
      this.detenerCompartirPantalla();
      this.detenerTemporizador();
      this.chatService.detenerPresenciaPaciente();
      this.router.navigate(['/recetas']);
    }
  }

  async iniciarCamaraPaciente(): Promise<void> {
    const iniciales = this.cita().pacienteIniciales || 'AG';
    const nombre = this.cita().pacienteNombre || 'Ana Gutiérrez';

    this.streamCamaraLocal = await this.webrtcService.crearStreamCamara(
      iniciales,
      nombre,
      'PACIENTE'
    );

    this.webrtcService.setMicrofonoActivo(this.microfonoActivo());
    this.webrtcService.setCamaraActiva(this.camaraActiva());

    setTimeout(() => {
      if (this.videoPacienteLocalRef?.nativeElement && this.streamCamaraLocal) {
        this.videoPacienteLocalRef.nativeElement.srcObject = this.streamCamaraLocal;
        this.videoPacienteLocalRef.nativeElement.muted = true;
        this.videoPacienteLocalRef.nativeElement.play().catch(() => {});
      }
    }, 80);

    await this.webrtcService.iniciarP2P(
      this.cita().idCita || 42,
      'PACIENTE',
      this.streamCamaraLocal
    );
  }

  detenerCamaraPaciente(): void {
    if (this.streamCamaraLocal) {
      this.streamCamaraLocal.getTracks().forEach((t) => t.stop());
      this.streamCamaraLocal = undefined;
    }
    this.webrtcService.cerrarConexion();
  }
}
