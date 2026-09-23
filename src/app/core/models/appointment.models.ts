export interface Cita {
  id_cita: number;
  id_paciente: number;
  id_medico: number;
  id_especialidad?: number | null;
  fecha_cita: string;
  hora_inicio: string;
  hora_fin?: string | null;
  motivo?: string | null;
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | string;
  tipo_consulta: 'PRESENCIAL' | 'TELEMEDICINA' | string;
  notas?: string | null;
  paciente_nombre: string;
  paciente_ci: string;
  paciente_iniciales: string;
  medico_nombre: string;
  especialidad_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CitaCreateRequest {
  id_paciente: number;
  id_medico: number;
  id_especialidad?: number | null;
  fecha_cita: string;
  hora_inicio: string;
  hora_fin?: string | null;
  motivo?: string | null;
  estado?: string;
  tipo_consulta?: string;
  notas?: string | null;
}

export interface CitaUpdateRequest {
  id_paciente?: number;
  id_medico?: number;
  id_especialidad?: number | null;
  fecha_cita?: string;
  hora_inicio?: string;
  hora_fin?: string | null;
  motivo?: string | null;
  estado?: string;
  tipo_consulta?: string;
  notas?: string | null;
}

export interface CitaListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Cita[];
}

export interface HorarioSlot {
  hora: string;
  hora_inicio?: string;
  hora_fin?: string;
  disponible: boolean;
}

