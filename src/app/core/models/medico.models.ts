export interface UsuarioInfo {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  foto_perfil?: string | null;
}

export interface EspecialidadResponse {
  id_especialidad: number;
  nombre: string;
  descripcion?: string | null;
  estado: string;
}

export interface EspecialidadMedico {
  id_especialidad: number;
  nombre: string;
  es_principal: boolean;
}

export interface MedicoResponse {
  id_medico: number;
  id_usuario: number;
  matricula_profesional: string;
  descripcion_profesional?: string | null;
  experiencia?: string | null;
  foto_perfil?: string | null;
  estado: string;
  fecha_registro: string;
  usuario?: UsuarioInfo | null;
  especialidades: EspecialidadMedico[];
}

export interface MedicoListResponse {
  total: number;
  items: MedicoResponse[];
}

export interface MedicoCreate {
  id_usuario: number;
  matricula_profesional: string;
  descripcion_profesional?: string;
  experiencia?: string;
  foto_perfil?: string;
  especialidades?: number[];
}

export interface MedicoUpdate {
  matricula_profesional?: string;
  descripcion_profesional?: string;
  experiencia?: string;
  foto_perfil?: string;
}

export interface EstadoUpdate {
  nuevo_estado: string;
}

export interface AsignacionEspecialidad {
  id_especialidad: number;
  es_principal: boolean;
}

export interface MedicoListFilters {
  nombre?: string;
  id_especialidad?: number;
  estado?: string;
  skip?: number;
  limit?: number;
}
