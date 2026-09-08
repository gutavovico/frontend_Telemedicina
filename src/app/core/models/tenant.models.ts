export interface TenantContext {
  clinica_id: number | null;
  clinica_nombre: string;
  clinica_estado: string | null;
  usuario_id: number;
  usuario_nombres: string;
  usuario_apellidos: string;
  usuario_correo: string;
  rol: string;
  permisos: string[];
  es_super_admin: boolean;
}

export interface ClinicaItem {
  clinica_id: number;
  nombre: string;
  razon_social?: string | null;
  nit?: string | null;
  estado: string;
  usuarios_activos: number;
  fecha_creacion?: string | null;
}

export interface ClinicaListResponse {
  total: number;
  page: number;
  per_page: number;
  items: ClinicaItem[];
}

export interface ClinicaEstadoUpdate {
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
}

export interface ClinicaEstadoResponse {
  clinica_id: number;
  nombre: string;
  estado: string;
  mensaje: string;
}

export interface ClinicaRegistroRequest {
  nombre: string;
  razon_social?: string;
  nit?: string;
  telefono?: string;
  direccion?: string;
  admin_nombres: string;
  admin_apellidos: string;
  admin_email: string;
  admin_password: string;
}

export interface ClinicaRegistroResponse {
  clinica: {
    id_clinica: number;
    nombre: string;
    estado: string;
  };
  administrador: {
    id_usuario: number;
    correo: string;
  };
}
