export interface Paciente {
  id_paciente: number;
  id_usuario?: number | null;
  nombres: string;
  apellidos: string;
  ci: string;
  complemento?: string | null;
  fecha_nacimiento: string;
  genero: string; // 'M' | 'F' | 'OTRO'
  telefono: string;
  correo?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  tipo_sangre?: string | null;
  alergias?: string | null;
  antecedentes_patologicos?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  contacto_emergencia_parentesco?: string | null;
  seguro_medico?: string | null;
  numero_seguro?: string | null;
  estado: string; // 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO'
  created_at: string;
  updated_at: string;
}

export interface PacienteCreateRequest {
  id_usuario?: number | null;
  nombres: string;
  apellidos: string;
  ci: string;
  complemento?: string;
  fecha_nacimiento: string;
  genero: string;
  telefono: string;
  correo?: string | null;
  direccion?: string | null;
  ciudad?: string;
  tipo_sangre?: string | null;
  alergias?: string | null;
  antecedentes_patologicos?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  contacto_emergencia_parentesco?: string | null;
  seguro_medico?: string | null;
  numero_seguro?: string | null;
}

export interface PacienteUpdateRequest {
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  correo?: string | null;
  direccion?: string | null;
  ciudad?: string;
  tipo_sangre?: string | null;
  alergias?: string | null;
  antecedentes_patologicos?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  contacto_emergencia_parentesco?: string | null;
  seguro_medico?: string | null;
  numero_seguro?: string | null;
  estado?: string;
}

export interface PacienteProfilePatchRequest {
  telefono?: string;
  correo?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  contacto_emergencia_parentesco?: string | null;
}

export interface PacientePaginationResponse {
  items: Paciente[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
