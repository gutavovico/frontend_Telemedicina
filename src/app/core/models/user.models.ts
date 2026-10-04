export interface UserRole {
  id_rol: number;
  nombre: string;
  descripcion?: string | null;
  estado?: string | null;
}

export interface AdminUser {
  id_usuario: number;
  id_clinica?: number | null;
  id_rol: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  foto_perfil?: string | null;
  estado: 'activo' | 'inactivo' | string;
  notificaciones_push?: boolean;
  notificaciones_email?: boolean;
  notificaciones_sms?: boolean;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
}

export interface AdminUserCreate {
  id_clinica?: number | null;
  id_rol: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  password: string;
  notificaciones_push?: boolean;
  notificaciones_email?: boolean;
  notificaciones_sms?: boolean;
}

export interface AdminUserUpdate {
  id_clinica?: number | null;
  id_rol: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  password?: string;
  notificaciones_push?: boolean;
  notificaciones_email?: boolean;
  notificaciones_sms?: boolean;
}

export interface AdminUserStatusUpdate {
  estado: 'activo' | 'inactivo';
}
