export interface EspecialidadItem {
  id_especialidad: number;
  nombre: string;
  es_principal?: boolean;
}

export interface ServicioItem {
  id_servicio: number;
  nombre: string;
  descripcion?: string | null;
  modalidad: 'PRESENCIAL' | 'TELECONSULTA' | string;
  costo: number;
  moneda: string;
  duracion_minutos: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface SlotItem {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

export interface DiaDisponibilidadItem {
  fecha: string;
  slots: SlotItem[];
}

export interface EspecialistaItem {
  id_medico: number;
  nombre_completo: string;
  foto_url: string | null;
  matricula_profesional: string;
  descripcion_profesional?: string | null;
  experiencia?: string | null;
  especialidades: EspecialidadItem[];
  servicios: ServicioItem[];
  disponibilidad: DiaDisponibilidadItem[];
}

export interface SpecialistSearchFilters {
  nombre?: string;
  especialidad_id?: number;
  modalidad?: 'PRESENCIAL' | 'TELECONSULTA' | 'AMBAS';
  costo_min?: number;
  costo_max?: number;
  fecha_inicio: string;
  fecha_fin: string;
  page?: number;
  per_page?: number;
}

export interface SpecialistSearchResponse {
  total: number;
  page: number;
  per_page: number;
  items: EspecialistaItem[];
}

