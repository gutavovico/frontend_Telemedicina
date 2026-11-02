import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  BackupConfig,
  BackupConfigUpdate,
  BackupListResponse,
  RestoreResponse,
} from '../models/backup.models';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly base = `${environment.apiUrl}/backup`;

  generar(): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.base}/generar`, null, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  listar(): Observable<BackupListResponse> {
    return this.http.get<BackupListResponse>(`${this.base}/listar`);
  }

  descargar(nombre: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/descargar/${encodeURIComponent(nombre)}`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  restaurar(archivo: File): Observable<RestoreResponse> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    return this.http.post<RestoreResponse>(`${this.base}/restaurar`, form);
  }

  getConfig(): Observable<BackupConfig> {
    return this.http.get<BackupConfig>(`${this.base}/config`);
  }

  updateConfig(config: BackupConfigUpdate): Observable<BackupConfig> {
    return this.http.put<BackupConfig>(`${this.base}/config`, config);
  }

  filename(response: HttpResponse<Blob>, fallback: string): string {
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const candidate = (plain ?? '').replace(/^.*[\\/]/, '');
    const safe = candidate.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    if (safe.toLowerCase().endsWith('.sql') && !safe.startsWith('.')) return safe;
    return fallback;
  }

  download(response: HttpResponse<Blob>, filename: string): void {
    if (!isPlatformBrowser(this.platformId) || !response.body) return;
    const blob = new Blob([response.body], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  errorMessage(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Tu sesión terminó. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes permiso para esta acción de respaldo.';
    if (error.status === 404) return 'Copia no encontrada.';
    if (typeof error.error === 'object' && error.error !== null && 'detail' in error.error) {
      const detail: unknown = (error.error as { detail: unknown }).detail;
      if (typeof detail === 'string' && detail !== '') return detail;
    }
    return 'No se pudo completar la operación. Inténtalo nuevamente.';
  }
}
