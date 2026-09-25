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
  // Compatibilidad histórica: nunca usar para inferir permisos.
  id_rol?: number | null;
  /**
   * Contrato oficial del backend (CU16, `GET /auth/me` → `UsuarioResponse.rol`):
   * nombre real de la relación `Usuario.rol` (`ADMIN`, `MEDICO`, `PACIENTE` o `null`).
   * Fuente primaria para `normalizeAppRole`. No es una suposición local.
   */
  rol?: string | null;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  foto_perfil?: string | null;
  estado: string;
  notificaciones_push?: boolean;
  notificaciones_email?: boolean;
  notificaciones_sms?: boolean;
  fecha_creacion?: string;
  creado_en?: string;
  actualizado_en?: string;
}

/**
 * Rol de aplicación reconocido por el frontend (CU16, hallazgo 1).
 * Fuente primaria: `UsuarioResponse.rol` del contrato oficial del backend
 * (`GET /auth/me`, nombre real de la relación `Usuario.rol`) normalizado
 * con `normalizeAppRole`. No es una suposición local.
 * `unknown` significa rol ausente o no reconocido: nunca concede privilegios.
 * Prohibido inferir el rol desde correo, nombre o IDs.
 */
export type AppRole = 'admin' | 'doctor' | 'paciente' | 'unknown';

/**
 * Normaliza el rol textual del backend de forma segura:
 * mayúsculas, espacios en extremos y acentos se ignoran.
 * - ADMIN, ADMINISTRADOR, ADMINISTRACION → 'admin'
 * - MEDICO, MÉDICO, DOCTOR → 'doctor'
 * - PACIENTE → 'paciente'
 * - Cualquier otro valor, nulo o vacío → 'unknown' (sin elevar privilegios).
 */
export function normalizeAppRole(rol: string | null | undefined): AppRole {
  if (rol === null || rol === undefined) {
    return 'unknown';
  }
  const limpio = rol
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (limpio === '') {
    return 'unknown';
  }
  if (limpio === 'ADMIN' || limpio === 'ADMINISTRADOR' || limpio === 'ADMINISTRACION') {
    return 'admin';
  }
  if (limpio === 'MEDICO' || limpio === 'DOCTOR') {
    return 'doctor';
  }
  if (limpio === 'PACIENTE') {
    return 'paciente';
  }
  return 'unknown';
}
