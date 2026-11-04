export interface CurrentSubscription {
  has_subscription: boolean;
  id_suscripcion?: string;
  tenant_id?: string;
  plan_nombre?: string;
  plan_version_id?: string;
  ciclo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  dias_gracia?: number;
  estado?: string;
  derived_status?: 'ACTIVE' | 'DUE_SOON' | 'EXPIRED' | 'TRIALING' | string;
  limite_medicos?: number;
  limite_consultas_mes?: number;
}

export interface PlanVersion {
  id_plan_version: string;
  nombre: string;
  descripcion?: string;
  precio_mensual: number;
  precio_anual: number;
  moneda: string;
  limite_medicos: number;
  limite_consultas_mes: number;
}

export interface CheckoutResponse {
  id_pago: string;
  monto: number;
  moneda: string;
  checkout_url: string;
  expira_en?: string;
}

export interface SubscriptionPaymentItem {
  id_pago: string;
  monto: number;
  moneda: string;
  ciclo: string;
  estado: string;
  plan_nombre?: string;
  numero_factura?: string;
  fecha_pago?: string;
  fecha_creacion: string;
}

export interface CheckoutStatusResponse {
  id_pago: string;
  estado: string;
  confirmado: boolean;
  checkout_url?: string;
  expira_en?: string;
}

export interface SubscriptionPaymentHistoryResponse {
  total: number;
  page: number;
  per_page: number;
  items: SubscriptionPaymentItem[];
}

