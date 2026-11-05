export interface TenantRequestItem {
  id_request: string;
  institucion_nombre: string;
  razon_social?: string;
  nit: string;
  correo: string;
  telefono?: string;
  responsable_nombre: string;
  responsable_correo: string;
  id_version_plan?: number;
  plan_version_id?: string;
  tracking_code: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  decision_motivo?: string;
  decision_fecha?: string;
  row_version: number;
  fecha_creacion: string;
}

export interface TenantRequestDetail extends TenantRequestItem {
  direccion?: string;
  responsable_telefono?: string;
  documentos_metadata?: string;
  tenant_id?: string;
  id_clinica?: number;
}

export interface TenantRequestListResponse {
  total: number;
  page: number;
  per_page: number;
  items: TenantRequestItem[];
}

export interface TenantItem {
  id_clinica: number;
  tenant_id?: string;
  nombre: string;
  razon_social?: string;
  nit?: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
  estado: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | string;
  id_version_plan?: number;
  plan_id?: string;
  commercial_notes?: string;
  row_version: number;
  fecha_creacion: string;
}

export interface TenantListResponse {
  total: number;
  page: number;
  per_page: number;
  items: TenantItem[];
}

export interface TenantStateAction {
  reason?: string;
  row_version: number;
}

export interface DeactivationRequestItem {
  id_deactivation: string;
  id_clinica: number;
  tenant_id?: string;
  institucion: string;
  motivo: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  row_version: number;
  decision_motivo?: string;
  decision_fecha?: string;
  fecha_creacion: string;
}

export interface DeactivationListResponse {
  total: number;
  page: number;
  per_page: number;
  items: DeactivationRequestItem[];
}

export interface CommercialAgreementUpdate {
  plan_id?: number;
  commercial_notes?: string;
  row_version: number;
}

