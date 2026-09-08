export interface LoginRequest {
  correo: string;
  password: string;
}

export interface RegisterRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  password: string;
  telefono?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface ForgotPasswordRequest {
  correo: string;
}

export interface ForgotPasswordResponse {
  detail: string;
  debug_code?: string | null;
}

export interface ResetPasswordRequest {
  correo: string;
  codigo: string;
  nueva_password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UsuarioResponse {
  id_usuario: number;
  id_clinica?: number | null;
  tenant_id?: string | null;
  id_rol?: number | null;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  foto_perfil?: string | null;
  estado: string;
  rol?: string | null;
  notificaciones_push?: boolean;
  notificaciones_email?: boolean;
  notificaciones_sms?: boolean;
  creado_en?: string;
  actualizado_en?: string;
}
