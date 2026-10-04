// DTOs CU08 Live Queue (derivan de openspec/contracts/live-queue.md). Sin `any`.
export type EstadoCola = 'NORMAL' | 'PAUSADA' | 'DEMORADA' | 'SIN_TURNOS';

export interface MiTurnoDTO {
  idCita: number;
  hora: string;
  estado: string;
  posicion: number;
  etaMinutos: number;
  delante: number;
  proximo: boolean;
  estadoCola: EstadoCola;
  mensajeCola: string | null;
  medicoNombre: string;
  fecha: string;
}

export interface EntradaColaDTO {
  idCita: number;
  hora: string;
  estado: string;
  posicion: number;
  etaMinutos: number;
  pacienteNombre: string;
  checkIn: string | null;
}

export interface ColaOperativaDTO {
  idMedico: number;
  medicoNombre: string;
  fecha: string;
  estadoCola: EstadoCola;
  mensajeCola: string | null;
  duracionPromedioMin: number;
  totalPendientes: number;
  entradas: EntradaColaDTO[];
}

export interface RegistrarPausaCommand {
  idMedico: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
}

/** Etiquetas de estado de cola para la UI. */
export function etiquetaEstadoCola(estado: EstadoCola): string {
  switch (estado) {
    case 'NORMAL':
      return 'Atención normal';
    case 'PAUSADA':
      return 'Atención pausada';
    case 'DEMORADA':
      return 'Con demora';
    case 'SIN_TURNOS':
      return 'Sin turnos';
  }
}
