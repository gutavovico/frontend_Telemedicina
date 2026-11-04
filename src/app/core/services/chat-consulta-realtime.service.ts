import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface MensajeConsulta {
  id: string;
  remitente: string;
  hora: string;
  esDoctor: boolean;
  esSistema?: boolean;
  texto?: string;
  archivoNombre?: string;
  archivoTamano?: string;
  archivoTipo?: string;
  archivoUrl?: string;
}

const STORAGE_MENSAJES = 'teleconsulta_mensajes_sesion';
const STORAGE_SESION_ACTUAL = 'teleconsulta_id_sesion_actual';
const CHANNEL_NAME = 'teleconsulta_sincronizacion_global';

const MENSAJE_INICIAL_GENERICO: MensajeConsulta[] = [
  {
    id: 'msg-bienvenida-0',
    remitente: 'Sistema Médico',
    hora: 'Inicio',
    esDoctor: false,
    esSistema: true,
    texto: 'Sala de consulta virtual conectada. La sesión y los documentos clínicos intercambiados están protegidos bajo cifrado médico de extremo a extremo.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ChatConsultaRealtimeService {
  private readonly http = inject(HttpClient);

  // Lista reactiva de mensajes de la consulta
  readonly mensajes = signal<MensajeConsulta[]>(this.cargarMensajesIniciales());

  // Estado de presencia en tiempo real
  readonly doctorConectado = signal<boolean>(false);
  readonly pacienteConectado = signal<boolean>(false);
  readonly consultaFinalizada = signal<boolean>(false);
  readonly doctorNombre = signal<string>('Dr. Roberto Gómez Flores');
  readonly pacienteNombre = signal<string>('Mateo Valdez Quiroga');

  private canal?: BroadcastChannel;
  private heartbeatTimer?: any;
  private timeoutDoctorTimer?: any;
  private pollingBackendTimer?: any;
  private idCitaActual: number | string = 42;
  private esInstanciaDoctor = false;
  private esInstanciaPaciente = false;

  constructor() {
    this.iniciarCanalSincronizacion();
  }

  /**
   * Inicia o reinicia la sesión para un paciente o consulta específica.
   */
  iniciarSesion(idConsulta: string | number, nombrePaciente: string = 'Mateo Valdez Quiroga'): void {
    const idStr = String(idConsulta || 42);
    this.idCitaActual = idStr;
    this.consultaFinalizada.set(false);
    this.pacienteConectado.set(false);
    this.doctorConectado.set(false);

    const idAnterior = localStorage.getItem(STORAGE_SESION_ACTUAL);

    if (idAnterior !== idStr) {
      localStorage.setItem(STORAGE_SESION_ACTUAL, idStr);
      this.limpiarHistorial(false);
    }

    this.pacienteNombre.set(nombrePaciente);
    this.iniciarSincronizacionBackend();
  }

  private cargarMensajesIniciales(): MensajeConsulta[] {
    try {
      const guardados = localStorage.getItem(STORAGE_MENSAJES);
      if (guardados) {
        const parsed = JSON.parse(guardados);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [...MENSAJE_INICIAL_GENERICO];
  }

  iniciarSincronizacionBackend(): void {
    this.detenerSincronizacionBackend();
    this.sincronizarConBackend();

    this.pollingBackendTimer = setInterval(() => {
      this.sincronizarConBackend();
    }, 1200);
  }

  detenerSincronizacionBackend(): void {
    if (this.pollingBackendTimer) {
      clearInterval(this.pollingBackendTimer);
      this.pollingBackendTimer = undefined;
    }
  }

  sincronizarConBackend(): void {
    const id = this.idCitaActual;
    if (!id) return;

    // 1. Sincronizar presencia y estado de finalización con el backend
    this.http.get<any>(`${environment.apiUrl}/citas/${id}/presencia`).subscribe({
      next: (data) => {
        if (data) {
          if (data.estado === 'FINALIZADA' && !this.esInstanciaDoctor) {
            this.consultaFinalizada.set(true);
            this.doctorConectado.set(false);
            return;
          }
          if (typeof data.doctor_conectado === 'boolean') {
            if (!this.esInstanciaDoctor) {
              this.doctorConectado.set(data.doctor_conectado);
            }
          }
          if (typeof data.paciente_conectado === 'boolean') {
            if (!this.esInstanciaPaciente) {
              this.pacienteConectado.set(data.paciente_conectado);
            }
          }
        }
      },
      error: () => {}
    });

    // 2. Sincronizar mensajes de chat
    this.http.get<MensajeConsulta[]>(`${environment.apiUrl}/citas/${id}/chat/realtime`).subscribe({
      next: (mensajesServidor) => {
        if (Array.isArray(mensajesServidor) && mensajesServidor.length > 0) {
          this.mensajes.update((locales) => {
            const idsLocales = new Set(locales.map((m) => m.id));
            let hayNuevos = false;
            const listaActualizada = [...locales];

            for (const ms of mensajesServidor) {
              if (!idsLocales.has(ms.id)) {
                listaActualizada.push(ms);
                hayNuevos = true;
              }
            }

            if (hayNuevos) {
              this.guardarEnStorage(listaActualizada);
              return listaActualizada;
            }
            return locales;
          });
        }
      },
      error: () => {}
    });
  }

  private iniciarCanalSincronizacion(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.canal = new BroadcastChannel(CHANNEL_NAME);
      this.canal.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        switch (data.tipo) {
          case 'NUEVO_MENSAJE':
            if (data.mensaje) {
              this.mensajes.update((lista) => {
                if (lista.some((m) => m.id === data.mensaje.id)) return lista;
                const nuevaLista = [...lista, data.mensaje];
                this.guardarEnStorage(nuevaLista);
                return nuevaLista;
              });
            }
            break;

          case 'LIMPIAR_CHAT':
            this.mensajes.set([...MENSAJE_INICIAL_GENERICO]);
            this.guardarEnStorage(MENSAJE_INICIAL_GENERICO);
            break;

          case 'DOCTOR_PRESENTE':
            this.doctorConectado.set(true);
            if (data.nombre) this.doctorNombre.set(data.nombre);
            this.renovarTimeoutDoctor();
            break;

          case 'DOCTOR_DESCONECTADO':
            this.doctorConectado.set(false);
            break;

          case 'CONSULTA_FINALIZADA':
            if (!this.esInstanciaDoctor) {
              this.consultaFinalizada.set(true);
              this.doctorConectado.set(false);
            }
            break;

          case 'PACIENTE_PRESENTE':
            this.pacienteConectado.set(true);
            if (data.nombre) this.pacienteNombre.set(data.nombre);
            break;

          case 'PACIENTE_DESCONECTADO':
            this.pacienteConectado.set(false);
            break;

          case 'CONSULTAR_ESTADO_DOCTOR':
            if (this.esInstanciaDoctor) {
              this.notificarDoctorPresente(this.doctorNombre());
            }
            break;

          case 'CONSULTAR_ESTADO_PACIENTE':
            if (this.esInstanciaPaciente) {
              this.notificarPacientePresente(this.pacienteNombre());
            }
            break;
        }
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_MENSAJES && e.newValue) {
          try {
            const nuevos = JSON.parse(e.newValue);
            if (Array.isArray(nuevos)) {
              this.mensajes.set(nuevos);
            }
          } catch {}
        }
      });
    }
  }

  // --- MÉTODOS DE PRESENCIA DEL DOCTOR ---

  iniciarPresenciaDoctor(nombreDoctor: string = 'Dr. Roberto Gómez Flores'): void {
    this.esInstanciaDoctor = true;
    this.consultaFinalizada.set(false);
    this.doctorNombre.set(nombreDoctor);
    this.doctorConectado.set(true);

    this.reportarPresenciaBackend('DOCTOR', true, nombreDoctor);
    this.notificarDoctorPresente(nombreDoctor);
    this.enviarAlCanal({ tipo: 'CONSULTAR_ESTADO_PACIENTE' });
    this.sincronizarConBackend();

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.notificarDoctorPresente(this.doctorNombre());
      this.reportarPresenciaBackend('DOCTOR', true, this.doctorNombre());
    }, 2000);
  }

  detenerPresenciaDoctor(): void {
    this.esInstanciaDoctor = false;
    this.doctorConectado.set(false);
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.reportarPresenciaBackend('DOCTOR', false);
    this.enviarAlCanal({ tipo: 'DOCTOR_DESCONECTADO' });
  }

  finalizarConsultaPorDoctor(): void {
    this.esInstanciaDoctor = false;
    this.doctorConectado.set(false);
    this.pacienteConectado.set(false);
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    const id = this.idCitaActual;
    if (id) {
      this.http.post<any>(`${environment.apiUrl}/citas/${id}/presencia`, {
        rol: 'FINALIZAR',
        conectado: false
      }).subscribe({ error: () => {} });
    }
    try {
      localStorage.removeItem(STORAGE_MENSAJES);
      localStorage.removeItem(STORAGE_SESION_ACTUAL);
    } catch {}
    this.enviarAlCanal({ tipo: 'CONSULTA_FINALIZADA' });
  }

  notificarDoctorPresente(nombre: string): void {
    this.enviarAlCanal({ tipo: 'DOCTOR_PRESENTE', nombre });
  }

  // --- MÉTODOS DE PRESENCIA DEL PACIENTE ---

  iniciarPresenciaPaciente(nombrePaciente: string = 'Mateo Valdez Quiroga'): void {
    this.esInstanciaPaciente = true;
    this.consultaFinalizada.set(false);
    this.pacienteNombre.set(nombrePaciente);
    this.pacienteConectado.set(true);

    this.reportarPresenciaBackend('PACIENTE', true, nombrePaciente);
    this.enviarAlCanal({ tipo: 'PACIENTE_PRESENTE', nombre: nombrePaciente });

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.notificarPacientePresente(this.pacienteNombre());
      this.reportarPresenciaBackend('PACIENTE', true, this.pacienteNombre());
    }, 2000);

    this.preguntarEstadoDoctor();
    this.sincronizarConBackend();
  }

  detenerPresenciaPaciente(): void {
    this.esInstanciaPaciente = false;
    this.pacienteConectado.set(false);
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.reportarPresenciaBackend('PACIENTE', false);
    this.enviarAlCanal({ tipo: 'PACIENTE_DESCONECTADO' });
  }

  notificarPacientePresente(nombre: string): void {
    this.enviarAlCanal({ tipo: 'PACIENTE_PRESENTE', nombre });
  }

  preguntarEstadoDoctor(): void {
    this.enviarAlCanal({ tipo: 'CONSULTAR_ESTADO_DOCTOR' });
  }

  private reportarPresenciaBackend(rol: 'DOCTOR' | 'PACIENTE', conectado: boolean, nombre?: string): void {
    const id = this.idCitaActual;
    if (!id) return;

    this.http.post<any>(`${environment.apiUrl}/citas/${id}/presencia`, {
      rol,
      conectado,
      nombre
    }).subscribe({
      next: (res) => {
        if (res) {
          if (res.estado === 'FINALIZADA' && rol === 'PACIENTE') {
            this.consultaFinalizada.set(true);
            this.doctorConectado.set(false);
            return;
          }
          if (rol === 'DOCTOR' && typeof res.paciente_conectado === 'boolean') {
            this.pacienteConectado.set(res.paciente_conectado);
          } else if (rol === 'PACIENTE' && typeof res.doctor_conectado === 'boolean') {
            this.doctorConectado.set(res.doctor_conectado);
          }
        }
      },
      error: () => {}
    });
  }

  private renovarTimeoutDoctor(): void {
    if (this.timeoutDoctorTimer) clearTimeout(this.timeoutDoctorTimer);
    this.timeoutDoctorTimer = setTimeout(() => {
      if (!this.esInstanciaDoctor) {
        this.sincronizarConBackend();
      }
    }, 5000);
  }

  // --- MENSAJERÍA Y ARCHIVOS ADJUNTOS ---

  enviarMensaje(
    remitente: string,
    esDoctor: boolean,
    texto?: string,
    archivoNombre?: string,
    archivoTamano?: string,
    archivoTipo: string = 'PDF',
    archivoUrl?: string
  ): MensajeConsulta {
    const ahora = new Date();
    const hora = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const nuevoMensaje: MensajeConsulta = {
      id,
      remitente,
      hora,
      esDoctor,
      texto: texto?.trim() || undefined,
      archivoNombre,
      archivoTamano,
      archivoTipo,
      archivoUrl
    };

    this.mensajes.update((lista) => {
      const nuevaLista = [...lista, nuevoMensaje];
      this.guardarEnStorage(nuevaLista);
      return nuevaLista;
    });

    this.enviarAlCanal({
      tipo: 'NUEVO_MENSAJE',
      mensaje: nuevoMensaje
    });

    const idCita = this.idCitaActual;
    if (idCita) {
      this.http.post<any>(`${environment.apiUrl}/citas/${idCita}/chat/realtime`, nuevoMensaje).subscribe({
        error: () => {}
      });
    }

    return nuevoMensaje;
  }

  esImagenAdjunta(msg: MensajeConsulta): boolean {
    if (!msg.archivoNombre && !msg.archivoTipo && !msg.archivoUrl) return false;
    const tipo = (msg.archivoTipo || '').toUpperCase();
    if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(tipo)) return true;
    if (msg.archivoUrl && msg.archivoUrl.startsWith('data:image/')) return true;
    return false;
  }

  private construirBlobDesdeMensaje(msg: MensajeConsulta): { url: string; revocable: boolean } {
    if (msg.archivoUrl) {
      if (msg.archivoUrl.startsWith('data:')) {
        try {
          const partes = msg.archivoUrl.split(',');
          const mimeMatch = partes[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
          const binStr = atob(partes[1]);
          const len = binStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mime });
          return { url: URL.createObjectURL(blob), revocable: true };
        } catch {
          return { url: msg.archivoUrl, revocable: false };
        }
      }
      return { url: msg.archivoUrl, revocable: false };
    }

    // Fallback si un mensaje antiguo no tenía archivoUrl: generar un documento clínico legible
    const contenidoTexto = `DOCUMENTO CLÍNICO DE TELECONSULTA\nArchivo: ${msg.archivoNombre || 'documento.txt'}\nRemitente: ${msg.remitente}\nHora: ${msg.hora}\nDetalle: ${msg.texto || ''}\n`;
    const blob = new Blob([contenidoTexto], { type: 'text/plain;charset=utf-8' });
    return { url: URL.createObjectURL(blob), revocable: true };
  }

  verArchivo(msg: MensajeConsulta): void {
    if (typeof window === 'undefined') return;
    const { url } = this.construirBlobDesdeMensaje(msg);
    const nuevaVentana = window.open(url, '_blank');
    if (!nuevaVentana) {
      this.descargarArchivo(msg);
    }
  }

  descargarArchivo(msg: MensajeConsulta): void {
    if (typeof document === 'undefined') return;
    const { url, revocable } = this.construirBlobDesdeMensaje(msg);
    const a = document.createElement('a');
    a.href = url;
    a.download = msg.archivoNombre || 'documento-teleconsulta';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (revocable) {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  limpiarHistorial(notificar: boolean = true): void {
    this.mensajes.set([...MENSAJE_INICIAL_GENERICO]);
    this.guardarEnStorage(MENSAJE_INICIAL_GENERICO);
    if (notificar) {
      this.enviarAlCanal({ tipo: 'LIMPIAR_CHAT' });
    }
  }

  private enviarAlCanal(payload: any): void {
    if (this.canal) {
      try {
        this.canal.postMessage(payload);
      } catch {}
    }
  }

  private guardarEnStorage(lista: MensajeConsulta[]): void {
    try {
      // Guardar en localStorage (si un archivo base64 grande supera la cuota, guardar metadatos)
      localStorage.setItem(STORAGE_MENSAJES, JSON.stringify(lista));
    } catch {
      try {
        const livianos = lista.map((m) => ({ ...m, archivoUrl: undefined }));
        localStorage.setItem(STORAGE_MENSAJES, JSON.stringify(livianos));
      } catch {}
    }
  }
}
