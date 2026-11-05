export interface PublicPlan {
  id_plan_version: string;
  nombre: string;
  descripcion?: string;
  precio_mensual: number;
  precio_anual: number;
  moneda: string;
  limite_medicos: number;
  limite_consultas_mes: number;
}

export interface OnboardingResponse {
  id_request: string;
  tracking_code: string;
  status: string;
}

export interface TrackingResponse {
  institucion: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  mensaje: string;
  fecha_decision?: string | null;
  access_email?: string | null;
  temporary_password?: string | null;
  expires_at?: string | null;
  remaining_reveals?: number | null;
}

export interface DeactivationRequestPayload {
  motivo: string;
}

export interface DeactivationResponse {
  id_deactivation: string;
  status: string;
  message: string;
}

