export type TipoExamenCategoria = 'HEMATOLOGIA' | 'BIOQUIMICA' | 'MICROBIOLOGIA' | 'INMUNOLOGIA' | 'OTROS';
export type EstadoOrden = 'BORRADOR' | 'FIRMADA' | 'ANULADA';

export interface ExamenOrdenRequest {
  codigo: string;
  indicaciones?: string;
}

export interface ExamenCatalogoResponse {
  id_examen: number;
  id_clinica: number;
  codigo: string;
  nombre: string;
  categoria: TipoExamenCategoria;
  precio_referencia?: number;
  activo: string;
  requiere_ayuno: number;
  tiempo_entrega_horas: number;
  created_at: string;
}

export interface ExamenOrdenResponse {
  codigo: string;
  nombre: string;
  indicaciones?: string;
}

export interface OrdenLaboratorioCreateRequest {
  id_paciente: number;
  id_cita?: number;
  examenes: ExamenOrdenRequest[];
}

export interface OrdenLaboratorioFirmarRequest {
  // La firma se deriva del contenido
}

export interface OrdenLaboratorioResponse {
  id_orden: number;
  id_clinica: number;
  id_paciente: number;
  id_cita?: number;
  id_medico: number;
  examenes: ExamenOrdenResponse[];
  firma_digital?: string;
  fecha_orden: string;
  estado: EstadoOrden;
  archivo_url?: string;
  hash_archivo?: string;
  created_at: string;
  updated_at: string;
  paciente_nombre?: string;
  medico_nombre?: string;
}

export interface OrdenLaboratorioListResponse {
  id_orden: number;
  id_clinica: number;
  id_paciente: number;
  paciente_nombre?: string;
  examenes_codigos: string[];
  estado: EstadoOrden;
  fecha_orden: string;
  created_at: string;
}

export interface OrdenLaboratorioPaginationResponse {
  items: OrdenLaboratorioListResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OrdenLaboratorioDownloadResponse {
  id_orden: number;
  url_firmada: string;
  expira_en: number;
  nombre_archivo: string;
  content_type: string;
}

export interface OrdenLaboratorioQueryParams {
  page?: number;
  page_size?: number;
  estado?: EstadoOrden;
  id_paciente?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  q?: string;
}