import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import type {
  ColaOperativaDTO,
  EntradaColaDTO,
  EstadoCola,
  MiTurnoDTO,
  RegistrarPausaCommand,
} from '../../../core/models/live-queue.models';

interface MiTurnoApi {
  id_cita: number;
  hora: string;
  estado: string;
  posicion: number;
  eta_minutos: number;
  delante: number;
  proximo: boolean;
  estado_cola: EstadoCola;
  mensaje_cola: string | null;
  medico_nombre: string;
  fecha: string;
}

interface EntradaColaApi {
  id_cita: number;
  hora: string;
  estado: string;
  posicion: number;
  eta_minutos: number;
  paciente_nombre: string;
  check_in: string | null;
}

interface ColaOperativaApi {
  id_medico: number;
  medico_nombre: string;
  fecha: string;
  estado_cola: EstadoCola;
  mensaje_cola: string | null;
  duracion_promedio_min: number;
  total_pendientes: number;
  entradas: EntradaColaApi[];
}

/** Mapeo snake_case (backend) → camelCase (contrato TS). Exportado para specs. */
export function mapMiTurno(api: MiTurnoApi): MiTurnoDTO {
  return {
    idCita: api.id_cita,
    hora: api.hora,
    estado: api.estado,
    posicion: api.posicion,
    etaMinutos: api.eta_minutos,
    delante: api.delante,
    proximo: api.proximo,
    estadoCola: api.estado_cola,
    mensajeCola: api.mensaje_cola,
    medicoNombre: api.medico_nombre,
    fecha: api.fecha,
  };
}

function mapEntrada(api: EntradaColaApi): EntradaColaDTO {
  return {
    idCita: api.id_cita,
    hora: api.hora,
    estado: api.estado,
    posicion: api.posicion,
    etaMinutos: api.eta_minutos,
    pacienteNombre: api.paciente_nombre,
    checkIn: api.check_in,
  };
}

/** Mapeo snake_case (backend) → camelCase (contrato TS). Exportado para specs. */
export function mapColaOperativa(api: ColaOperativaApi): ColaOperativaDTO {
  return {
    idMedico: api.id_medico,
    medicoNombre: api.medico_nombre,
    fecha: api.fecha,
    estadoCola: api.estado_cola,
    mensajeCola: api.mensaje_cola,
    duracionPromedioMin: api.duracion_promedio_min,
    totalPendientes: api.total_pendientes,
    entradas: (api.entradas ?? []).map(mapEntrada),
  };
}

@Injectable({ providedIn: 'root' })
export class LiveQueueService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/v1/cola`;

  private readonly _miTurno = signal<MiTurnoDTO | null>(null);
  private readonly _cola = signal<ColaOperativaDTO | null>(null);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  readonly miTurno = computed(() => this._miTurno());
  readonly cola = computed(() => this._cola());
  readonly cargando = computed(() => this._cargando());
  readonly error = computed(() => this._error());

  cargarMiTurno(silencioso = false): void {
    if (!silencioso) {
      this._cargando.set(true);
    }
    this._error.set(null);
    this.http.get<MiTurnoApi>(`${this.apiUrl}/mi-turno`).subscribe({
      next: (data) => {
        this._miTurno.set(mapMiTurno(data));
        this._cargando.set(false);
      },
      error: (err) => {
        this._cargando.set(false);
        this._error.set(err?.error?.detail ?? 'No se pudo consultar tu turno.');
      },
    });
  }

  cargarCola(idMedico?: number, fecha?: string, silencioso = false): void {
    if (!silencioso) {
      this._cargando.set(true);
    }
    this._error.set(null);
    let params = new HttpParams();
    if (idMedico) {
      params = params.set('id_medico', String(idMedico));
    }
    if (fecha) {
      params = params.set('fecha', fecha);
    }
    this.http.get<ColaOperativaApi>(this.apiUrl, { params }).subscribe({
      next: (data) => {
        this._cola.set(mapColaOperativa(data));
        this._cargando.set(false);
      },
      error: (err) => {
        this._cargando.set(false);
        this._error.set(err?.error?.detail ?? 'No se pudo cargar la fila virtual.');
      },
    });
  }

  avanzar(idCita: number, onDone?: () => void): void {
    this.http.post<ColaOperativaApi>(`${this.apiUrl}/${idCita}/avanzar`, {}).subscribe({
      next: (data) => {
        this._cola.set(mapColaOperativa(data));
        onDone?.();
      },
      error: (err) => this._error.set(err?.error?.detail ?? 'No se pudo avanzar la fila.'),
    });
  }

  marcarPerdida(idCita: number, onDone?: () => void): void {
    this.http.post<ColaOperativaApi>(`${this.apiUrl}/${idCita}/perdida`, {}).subscribe({
      next: (data) => {
        this._cola.set(mapColaOperativa(data));
        onDone?.();
      },
      error: (err) => this._error.set(err?.error?.detail ?? 'No se pudo marcar el turno.'),
    });
  }

  registrarPausa(cmd: RegistrarPausaCommand, onDone?: () => void): void {
    this.http
      .post(`${this.apiUrl}/pausas`, {
        id_medico: cmd.idMedico,
        fecha: cmd.fecha,
        hora_inicio: cmd.horaInicio,
        hora_fin: cmd.horaFin,
        motivo: cmd.motivo,
      })
      .subscribe({
        next: () => onDone?.(),
        error: (err) => this._error.set(err?.error?.detail ?? 'No se pudo registrar la pausa.'),
      });
  }

  iniciarPollingMiTurno(intervalMs = 5000): void {
    this.detenerPolling();
    this.pollingTimer = setInterval(() => this.cargarMiTurno(true), intervalMs);
  }

  iniciarPollingCola(idMedico?: number, fecha?: string, intervalMs = 5000): void {
    this.detenerPolling();
    this.pollingTimer = setInterval(() => this.cargarCola(idMedico, fecha, true), intervalMs);
  }

  detenerPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}
