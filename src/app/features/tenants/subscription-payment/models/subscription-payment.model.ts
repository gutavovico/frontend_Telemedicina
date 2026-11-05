import type { VersionPlan as CatalogVersion } from '../../../../core/models/plan.models';
export interface CurrentSubscription {
  has_subscription: boolean;
  id_suscripcion?: string;
  tenant_id?: string;
  plan_nombre?: string;
  id_plan_version?: number;
  plan_version_id?: number;
  ciclo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  dias_gracia?: number;
  estado?: string;
  derived_status?: 'ACTIVE' | 'DUE_SOON' | 'EXPIRED' | 'TRIALING' | string;
  version?: CatalogVersion;
  row_version?: number;
  limite_sedes?: number | null;
  limite_medicos?: number | null;
  limite_consultas_mes?: number | null;
}

export interface PlanVersion extends CatalogVersion {
  id_plan_version: number;
  limite_consultas_mes: number | null;
}

export interface CheckoutResponse {
  id_pago: string;
  monto: string;
  moneda: string;
  checkout_url: string;
  expira_en?: string;
}

export interface SubscriptionPaymentItem {
  application_status: string;
  application_reason?: string | null;
  plan_version_id: number;
  version: CatalogVersion;
  purpose: 'RENEWAL' | 'UPGRADE';
  id_pago: string;
  monto: string;
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
  application_status: string;
  application_reason?: string | null;
  effective_at?: string | null;
  checkout_url?: string;
  expira_en?: string;
}

export interface SubscriptionPaymentHistoryResponse {
  total: number;
  page: number;
  per_page: number;
  items: SubscriptionPaymentItem[];
}


export interface ChangeQuote {
  amount: string;
  currency: 'BOB';
  effective_at: string;
  cycle_end: string;
  quote_token: string;
  expires_at: string;
}
export interface SubscriptionChange {
  target_version?: CatalogVersion | null;
  id: string;
  source_version_id: number;
  target_version_id: number | null;
  operation: 'IMMEDIATE' | 'NEXT_CYCLE' | 'CANCEL';
  status: string;
  amount: string;
  effective_at: string;
  applied_at: string | null;
  payment_id: string | null;
  reason: string | null;
  checkout_url: string | null;
}
