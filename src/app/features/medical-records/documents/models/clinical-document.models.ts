// Modelos CU12 - Documentos Clínicos y Exámenes.
// Basados en openspec/contracts/clinical-documents.md (v1.0.0).

export type TipoDocumento = 'RECETA' | 'ORDEN_LAB' | 'RESULTADO_LAB' | 'CERTIFICADO' | 'INDICACION';
export type EstadoDocumento = 'ACTIVO' | 'ANULADO';

export interface DocumentoClinico {
  id_documento: number;
  id_clinica: number;
  tenant_id?: number | null;
  id_paciente?: number | null;
  id_cita?: number | null;
  tipo_documento: TipoDocumento;
  titulo: string;
  descripcion?: string | null;
  archivo_url: string;
  hash_archivo: string;
  firmado_por?: number | null;
  fecha_documento: string;
  metadatos?: Record<string, unknown> | null;
  estado: EstadoDocumento;
  created_at: string;
  updated_at: string;
  paciente_nombre?: string | null;
  firmante_nombre?: string | null;
}

export interface DocumentoResumen {
  id_documento: number;
  id_clinica: number;
  id_paciente?: number | null;
  tipo_documento: TipoDocumento;
  titulo: string;
  fecha_documento: string;
  estado: EstadoDocumento;
  created_at: string;
  paciente_nombre?: string | null;
}

export interface DocumentoPaginacionResponse {
  items: DocumentoResumen[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DocumentoCreateRequest {
  id_paciente?: number | null;
  id_cita?: number | null;
  tipo_documento: TipoDocumento;
  titulo: string;
  descripcion?: string | null;
  archivo_url: string;
  hash_archivo: string;
  firmado_por?: number | null;
  fecha_documento: string;
  metadatos?: Record<string, unknown> | null;
}

export interface DocumentoUpdateRequest {
  titulo?: string;
  descripcion?: string | null;
  metadatos?: Record<string, unknown> | null;
  estado?: EstadoDocumento;
}

export interface DocumentoDownloadResponse {
  id_documento: number;
  url_firmada: string;
  expira_en: number;
  nombre_archivo: string;
  content_type: string;
}

export interface DocumentoQueryParams {
  page?: number;
  page_size?: number;
  tipo_documento?: TipoDocumento;
  fecha_desde?: string;
  fecha_hasta?: string;
  id_paciente?: number;
  q?: string;
}