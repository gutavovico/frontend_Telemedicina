import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ExportRequest, ReportFormat, ReportQuery } from '../../reportes/models/report.models';

const MIME: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  html: 'text/html; charset=utf-8',
};

@Injectable({ providedIn: 'root' })
export class ReportExportService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly url = `${environment.apiUrl}/analytics/reportes/exportar`;

  export(definition: ReportQuery, formato: ReportFormat): Observable<HttpResponse<Blob>> {
    const request: ExportRequest = { ...definition, formato };
    return this.http.post(this.url, request, { observe: 'response', responseType: 'blob' });
  }

  filename(response: HttpResponse<Blob>, definition: ReportQuery, format: ReportFormat): string {
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    let candidate = plain ?? '';
    if (encoded) {
      try {
        candidate = decodeURIComponent(encoded);
      } catch {
        candidate = '';
      }
    }
    const safe = candidate.replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    if (safe && !safe.startsWith('.') && safe.toLowerCase().endsWith(`.${format}`)) {
      return safe;
    }
    const report = definition.reporte.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    return `reporte_${report}_${new Date().toISOString().slice(0, 10)}.${format}`;
  }

  download(response: HttpResponse<Blob>, filename: string, format: ReportFormat): void {
    if (!isPlatformBrowser(this.platformId) || !response.body) return;
    const blob = new Blob([response.body], { type: MIME[format] });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async errorMessage(error: HttpErrorResponse): Promise<string> {
    if (error.status === 413) {
      return 'El reporte supera el límite de exportación. Reduce el período o ajusta filtros y agrupaciones.';
    }
    if (error.status === 401) return 'Tu sesión terminó. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes permiso para exportar este reporte.';
    if (error.error instanceof Blob) {
      try {
        const payload: unknown = JSON.parse(await error.error.text());
        if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
          const detail = (payload as { detail: unknown }).detail;
          if (typeof detail === 'string' && detail !== '') return detail;
        }
      } catch {
        // The transport can return a non-JSON Blob for network failures.
      }
    }
    return 'No se pudo preparar la descarga. Inténtalo nuevamente.';
  }
}
