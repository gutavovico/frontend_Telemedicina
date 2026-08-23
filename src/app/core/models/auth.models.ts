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

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UsuarioResponse {
  id_usuario: number;
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
