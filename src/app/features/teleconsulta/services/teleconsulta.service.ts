import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  TeleconsultaViewDTO,
  ChatMessageDTO,
  SendChatMessageCommand
} from '../../../core/models/teleconsulta.models';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

const INITIAL_FALLBACK_DATA: TeleconsultaViewDTO = {
  nombreClinica: 'Hospital San Juan de Dios',
  usuarioActivo: {
    idUsuario: 10,
    nombre: 'Carlos Pérez',
    iniciales: 'CP'
  },
  paciente: {
    idPaciente: 10,
    nombreCompleto: 'Carlos Pérez',
    identificacionId: '12345678X',
    inicialesAvatar: 'CP',
    seguroProveedor: 'Sanitas Plus',
    seguroPoliza: 'Sanitas Plus'
  },
  cita: {
    idCita: 105,
    nombreMedico: 'Dra. Ana López',
    especialidad: 'Medicina General',
    rangoFechas: '02/09/2024 - 01/02/2024',
    horaTeleconsulta: '17:00 h',
    modalidad: 'TELEMEDICINA',
    estado: 'CONFIRMADA'
  },
  medico: {
    idMedico: 42,
    nombreCompleto: 'Dra. Ana López',
    cargoEtiqueta: 'Su Médico',
    biografia: 'Dra. Ana López es especialista en medicina general, con trayectoria en atención ambulatoria, medicina preventiva y seguimiento clínico personalizado.',
    fotoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
    estadoDisponibilidad: 'DISPONIBLE'
  },
  mensajes: [
    {
      idMensaje: 1,
      idRemitente: 42,
      nombreRemitente: 'Dra. López',
      rolRemitente: 'MEDICO',
      contenido: 'Hola Carlos, estoy revisando su historial. ¿Tiene alguna pregunta antes de empezar?',
      horaDisplay: '17:00 h',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=120',
      esPropio: false,
      leido: true
    }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class TeleconsultaService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/api/v1`;

  // Estado privado reactivo con Angular Signals
  private readonly _state = signal<TeleconsultaViewDTO>(INITIAL_FALLBACK_DATA);
  private readonly _cargando = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Intervalo para sincronización en tiempo real (polling silencioso)
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  // Computed signals públicas para consumo reactivo desacoplado
  readonly teleconsulta = computed(() => this._state());
  readonly paciente = computed(() => this._state().paciente);
  readonly cita = computed(() => this._state().cita);
  readonly medico = computed(() => this._state().medico);
  readonly mensajes = computed(() => this._state().mensajes);
  readonly usuarioActivo = computed(() => this._state().usuarioActivo);
  readonly nombreClinica = computed(() => this._state().nombreClinica);
  readonly cargando = computed(() => this._cargando());
  readonly error = computed(() => this._error());

  constructor() {
    this.sincronizarUsuarioLocal();
  }

  private sincronizarUsuarioLocal(): void {
    const user = this.authService.currentUser();
    if (user) {
      const nombreCompleto = `${user.nombres} ${user.apellidos || ''}`.trim() || user.correo;
      const iniciales = this.authService.userInitials();
      this._state.update((prev) => ({
        ...prev,
        usuarioActivo: {
          idUsuario: user.id_usuario,
          nombre: nombreCompleto,
          iniciales: iniciales
        },
        paciente: {
          ...prev.paciente,
          idPaciente: user.id_usuario,
          nombreCompleto: nombreCompleto,
          inicialesAvatar: iniciales
        }
      }));
    }
  }

  /**
   * Carga la teleconsulta y el historial de chat desde el backend FastAPI (CU15).
   * Si idCita no se especifica, consulta `/citas/me/teleconsulta`.
   */
  cargarTeleconsulta(idCita?: number): void {
    this._cargando.set(true);
    this._error.set(null);

    const endpoint = idCita && idCita > 0
      ? `${this.apiUrl}/citas/${idCita}/teleconsulta`
      : `${this.apiUrl}/citas/me/teleconsulta`;

    this.http.get<TeleconsultaViewDTO>(endpoint).subscribe({
      next: (data) => {
        const user = this.authService.currentUser();
        const currentUserId = user?.id_usuario;

        // Normalizar bandera esPropio según el usuario actualmente autenticado
        const mensajesAlineados = (data.mensajes || []).map((m) => ({
          ...m,
          esPropio: currentUserId ? m.idRemitente === currentUserId : m.esPropio
        }));

        this._state.set({
          ...data,
          mensajes: mensajesAlineados
        });
        this._cargando.set(false);
      },
      error: (err) => {
        console.warn('[TeleconsultaService] No se pudo cargar teleconsulta desde API, manteniendo estado actual:', err);
        this._error.set('No se pudo sincronizar la teleconsulta con el servidor. Mostrando información local.');
        this._cargando.set(false);
      }
    });
  }

  /**
   * Refresco silencioso para sincronización periódica de mensajes en tiempo real.
   */
  refrescarSilencioso(idCita?: number): void {
    const citaActual = this._state().cita?.idCita;
    const targetCita = idCita || citaActual;

    const endpoint = targetCita && targetCita > 0
      ? `${this.apiUrl}/citas/${targetCita}/teleconsulta`
      : `${this.apiUrl}/citas/me/teleconsulta`;

    this.http.get<TeleconsultaViewDTO>(endpoint).subscribe({
      next: (data) => {
        const user = this.authService.currentUser();
        const currentUserId = user?.id_usuario;

        const mensajesAlineados = (data.mensajes || []).map((m) => ({
          ...m,
          esPropio: currentUserId ? m.idRemitente === currentUserId : m.esPropio
        }));

        // Solo actualizar si hay cambios en mensajes para evitar re-render innecesario
        const mensajesActuales = this._state().mensajes;
        if (mensajesAlineados.length !== mensajesActuales.length) {
          this._state.update((prev) => ({
            ...prev,
            ...data,
            mensajes: mensajesAlineados
          }));
        }
      },
      error: () => {
        // Fallo silencioso en sondeo periódico
      }
    });
  }

  /**
   * Inicia el sondeo en tiempo real cada `intervalMs` (por defecto 5000ms).
   */
  iniciarPolling(idCita?: number, intervalMs = 5000): void {
    this.detenerPolling();
    this.pollingTimer = setInterval(() => {
      this.refrescarSilencioso(idCita);
    }, intervalMs);
  }

  /**
   * Detiene el sondeo en segundo plano al salir de la vista.
   */
  detenerPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Envía un mensaje con actualización optimista (Optimistic UI) inmediata y persistencia en el backend.
   */
  enviarMensaje(
    contenido: string,
    idCitaOverride?: number,
    adjunto?: { nombre: string; tamano: string; url: string }
  ): void {
    const texto = contenido.trim();
    if (!texto && !adjunto) return;

    const estadoActual = this._state();
    const idCita = idCitaOverride || estadoActual.cita?.idCita || 12;
    const ahora = new Date();
    const horaDisplay = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' h';

    const user = this.authService.currentUser();
    const idRemitente = user ? user.id_usuario : estadoActual.usuarioActivo.idUsuario;
    const nombreRemitente = user ? `${user.nombres} ${user.apellidos || ''}`.trim() : estadoActual.usuarioActivo.nombre;
    const rolRemitente: 'MEDICO' | 'PACIENTE' = this.authService.isDoctor() ? 'MEDICO' : 'PACIENTE';

    // Generar ID temporal único para Optimistic UI
    const tempId = -Date.now();

    const nuevoMensajeOptimista: ChatMessageDTO = {
      idMensaje: tempId,
      idRemitente,
      nombreRemitente,
      rolRemitente,
      contenido: texto || (adjunto ? `Archivo adjunto: ${adjunto.nombre}` : ''),
      horaDisplay,
      avatarUrl: user?.foto_perfil || null,
      esPropio: true,
      leido: false,
      adjuntoNombre: adjunto?.nombre || null,
      adjuntoTamano: adjunto?.tamano || null,
      adjuntoUrl: adjunto?.url || null
    };

    // 1. Inserción optimista inmediata en la UI
    this._state.update((prev) => ({
      ...prev,
      mensajes: [...prev.mensajes, nuevoMensajeOptimista]
    }));

    // 2. Persistencia en Backend FastAPI
    const command: SendChatMessageCommand = {
      idCita,
      contenido: texto || (adjunto ? `Archivo adjunto: ${adjunto.nombre}` : ''),
      adjuntoNombre: adjunto?.nombre || null,
      adjuntoTamano: adjunto?.tamano || null,
      adjuntoUrl: adjunto?.url || null
    };

    this.http.post<ChatMessageDTO>(`${this.apiUrl}/citas/${idCita}/chat/mensajes`, command).subscribe({
      next: (mensajePersistido) => {
        // Reconciliación: sustituir mensaje temporal por el mensaje confirmado por el backend
        this._state.update((prev) => ({
          ...prev,
          mensajes: prev.mensajes.map((m) =>
            m.idMensaje === tempId
              ? { ...mensajePersistido, esPropio: true }
              : m
          )
        }));
      },
      error: (err) => {
        console.error('[TeleconsultaService] Error al persistir mensaje:', err);
        this._error.set('No se pudo enviar el mensaje al servidor.');
        // Reversión (rollback) del mensaje optimista en caso de fallo crítico
        this._state.update((prev) => ({
          ...prev,
          mensajes: prev.mensajes.filter((m) => m.idMensaje !== tempId)
        }));
      }
    });
  }
}
