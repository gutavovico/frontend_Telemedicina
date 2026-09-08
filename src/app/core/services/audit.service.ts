import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLogEntry, AuditLogFilters, AuditLogListResponse } from '../models/audit.models';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/audit-log`;

  private buildParams(filters?: AuditLogFilters, page?: number, pageSize?: number): HttpParams {
    let params = new HttpParams();

    if (page !== undefined && page !== null) {
      params = params.set('page', page.toString());
    }
    if (pageSize !== undefined && pageSize !== null) {
      params = params.set('page_size', pageSize.toString());
    }

    if (filters) {
      if (filters.fecha_inicio) {
        params = params.set('fecha_inicio', filters.fecha_inicio);
      }
      if (filters.fecha_fin) {
        params = params.set('fecha_fin', filters.fecha_fin);
      }
      if (filters.id_usuario !== undefined && filters.id_usuario !== null) {
        params = params.set('id_usuario', filters.id_usuario.toString());
      }
      if (filters.accion) {
        params = params.set('accion', filters.accion);
      }
      if (filters.tabla_afectada) {
        params = params.set('tabla_afectada', filters.tabla_afectada);
      }
      if (filters.registro_id !== undefined && filters.registro_id !== null) {
        params = params.set('registro_id', filters.registro_id.toString());
      }
      if (filters.busqueda) {
        params = params.set('busqueda', filters.busqueda.trim());
      }
    }

    return params;
  }

  /**
   * Consulta paginada y con filtros de la bitácora de auditoría (CU21).
   */
  getAuditLogs(filters?: AuditLogFilters, page: number = 1, pageSize: number = 20): Observable<AuditLogListResponse> {
    const params = this.buildParams(filters, page, pageSize);
    return this.http.get<AuditLogListResponse>(this.baseUrl, { params });
  }

  /**
   * Obtiene el detalle de un registro específico de auditoría.
   */
  getAuditLogById(id: number): Observable<AuditLogEntry> {
    return this.http.get<AuditLogEntry>(`${this.baseUrl}/${id}`);
  }

  /**
   * Descarga el reporte de bitácora en formato PDF.
   */
  exportPdf(filters?: AuditLogFilters): Observable<Blob> {
    const params = this.buildParams(filters);
    return this.http.get(`${this.baseUrl}/export/pdf`, {
      params,
      responseType: 'blob'
    });
  }

  /**
   * Descarga el reporte de bitácora en formato Excel (.xlsx).
   */
  exportExcel(filters?: AuditLogFilters): Observable<Blob> {
    const params = this.buildParams(filters);
    return this.http.get(`${this.baseUrl}/export/excel`, {
      params,
      responseType: 'blob'
    });
  }

  /**
   * Dispara la descarga en el navegador de un Blob con nombre de archivo.
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }
}
