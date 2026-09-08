export interface AuditLogEntry {
  id_auditoria: number;
  id_clinica?: number;
  tenant_id?: string | number;
  id_usuario: number;
  nombre_usuario: string;
  correo_usuario?: string;
  tabla_afectada?: string;
  registro_id?: number;
  accion: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT' | 'LOGIN' | string;
  descripcion?: string;
  datos_anteriores?: Record<string, unknown> | unknown[] | string | null;
  datos_nuevos?: Record<string, unknown> | unknown[] | string | null;
  direccion_ip?: string;
  fecha_hora: string;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogFilters {
  fecha_inicio?: string;
  fecha_fin?: string;
  id_usuario?: number | null;
  accion?: string;
  tabla_afectada?: string;
  registro_id?: number | null;
  busqueda?: string;
}
