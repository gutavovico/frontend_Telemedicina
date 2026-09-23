/** Contratos de los schemas CU05 implementados en el backend. */
export interface ServicioAgenda {
  id_servicio: number;
  nombre: string;
  descripcion: string | null;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  costo: string;
  estado: string;
}
export type EstadoHorario = 'activo' | 'inactivo';
export type EstadoBloqueo = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'LIBERADO';
export type AccionBloqueo = 'aprobar' | 'rechazar' | 'liberar';
export type RolAgenda = 'MEDICO' | 'RECEPCION' | 'ADMIN' | 'DESCONOCIDO';
export interface HorarioCreate {
  id_medico?: number;
  id_servicio: number;
  dia_semana: number;
}
export interface HorarioAgenda extends HorarioCreate {
  id_horario: number;
  id_medico: number;
  estado: EstadoHorario;
}
export interface BloqueoCreate {
  id_medico?: number;
  id_servicio: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string;
}
export interface BloqueoAgenda extends BloqueoCreate {
  id_bloqueo: number;
  id_medico: number;
  estado: EstadoBloqueo;
}
export interface AccionBloqueoResponse extends BloqueoAgenda {
  citas_afectadas: number[];
  notificaciones_creadas: number;
  advertencias: string[];
}
export interface SlotAgenda {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}
export interface DisponibilidadAgenda {
  id_medico: number;
  id_servicio: number;
  fecha: string;
  slots: SlotAgenda[];
  citas_verificadas: boolean;
  advertencias: string[];
}
/** Campos efectivos de GET /auth/me; no inferir nombres a partir de id_rol. */
export interface SesionAgenda {
  id_usuario: number;
  id_clinica: number | null;
  id_rol: number | null;
  nombres: string;
  apellidos: string;
}
