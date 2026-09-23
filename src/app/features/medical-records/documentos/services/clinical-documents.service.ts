import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  DocumentoClinico,
  DocumentoCreateRequest,
  DocumentoDownloadResponse,
  DocumentoPaginacionResponse,
  DocumentoQueryParams,
  DocumentoResumen,
  DocumentoUpdateRequest
} from '../models/clinical-document.models';

@Injectable({
  providedIn: 'root'
})
export class ClinicalDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/documentos`;

  // Estado reactivo (misma convención que PatientService)
  readonly documents = signal<DocumentoResumen[]>([]);
  readonly selectedDocument = signal<DocumentoClinico | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly totalRecords = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly currentPage = signal<number>(1);

  private buildParams(params: DocumentoQueryParams = {}): HttpParams {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('page_size', (params.page_size ?? 10).toString());

    if (params.tipo_documento) httpParams = httpParams.set('tipo_documento', params.tipo_documento);
    if (params.fecha_desde) httpParams = httpParams.set('fecha_desde', params.fecha_desde);
    if (params.fecha_hasta) httpParams = httpParams.set('fecha_hasta', params.fecha_hasta);
    if (params.id_paciente != null) httpParams = httpParams.set('id_paciente', params.id_paciente.toString());
    if (params.q && params.q.trim()) httpParams = httpParams.set('q', params.q.trim());
    return httpParams;
  }

  /**
   * Lista los documentos clínicos del tenant (ADMIN/MEDICO/RECEPCION) o del
   * propio paciente autenticado si `modo = 'me'` (PACIENTE).
   */
  getDocuments(modo: 'tenant' | 'me' = 'tenant', params: DocumentoQueryParams = {}): Observable<DocumentoPaginacionResponse> {
    this.isLoading.set(true);
    const path = modo === 'me' ? `${this.baseUrl}/me` : this.baseUrl;
    return this.http.get<DocumentoPaginacionResponse>(path, { params: this.buildParams(params) }).pipe(
      tap({
        next: (res) => {
          this.documents.set(res.items);
          this.totalRecords.set(res.total);
          this.totalPages.set(res.total_pages);
          this.currentPage.set(res.page);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /** Lista los documentos de un paciente específico del tenant (roles staff). */
  getPatientDocuments(idPaciente: number, params: DocumentoQueryParams = {}): Observable<DocumentoPaginacionResponse> {
    this.isLoading.set(true);
    return this.http
      .get<DocumentoPaginacionResponse>(`${environment.apiUrl}/api/v1/pacientes/${idPaciente}/documentos`, {
        params: this.buildParams(params)
      })
      .pipe(
        tap({
          next: () => this.isLoading.set(false),
          error: () => this.isLoading.set(false)
        })
      );
  }

  /** Obtiene el detalle/metadata de un documento por ID. */
  getDocumentById(id: number): Observable<DocumentoClinico> {
    this.isLoading.set(true);
    return this.http.get<DocumentoClinico>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: (doc) => {
          this.selectedDocument.set(doc);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  /** Genera URL firmada de descarga (registra auditoría y notificación en backend). */
  getDownloadUrl(id: number): Observable<DocumentoDownloadResponse> {
    return this.http.get<DocumentoDownloadResponse>(`${this.baseUrl}/${id}/download`);
  }

  /** Registra un documento clínico (ADMIN/MEDICO). */
  createDocument(data: DocumentoCreateRequest): Observable<DocumentoClinico> {
    this.isLoading.set(true);
    return this.http.post<DocumentoClinico>(this.baseUrl, data).pipe(
      tap({
        next: (doc) => {
          this.documents.update((prev) => [doc, ...prev]);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  /** Actualiza metadata de un documento (ADMIN/MEDICO). */
  updateDocument(id: number, data: DocumentoUpdateRequest): Observable<DocumentoClinico> {
    this.isLoading.set(true);
    return this.http.put<DocumentoClinico>(`${this.baseUrl}/${id}`, data).pipe(
      tap({
        next: (upd) => {
          this.documents.update((prev) => prev.map((d) => (d.id_documento === id ? upd : d)));
          if (this.selectedDocument()?.id_documento === id) this.selectedDocument.set(upd);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  /** Anula (baja lógica) un documento clínico (ADMIN). */
  deleteDocument(id: number): Observable<{ detail: string; id_documento: number; estado: string }> {
    this.isLoading.set(true);
    return this.http.delete<{ detail: string; id_documento: number; estado: string }>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: () => {
          this.documents.update((prev) => prev.filter((d) => d.id_documento !== id));
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  /** Descarga el contenido binario del PDF usando la URL firmada. */
  async loadDocumentBlob(urlFirmada: string): Promise<Blob> {
    const isLocal = urlFirmada.includes(environment.apiUrl) || urlFirmada.startsWith('/');
    const resolved = isLocal
      ? urlFirmada.startsWith('http') ? urlFirmada : `${environment.apiUrl}${urlFirmada}`
      : urlFirmada;

    if (isLocal) {
      // Vía HttpClient: el interceptor adjunta el Bearer token.
      return this.http.get(resolved, { responseType: 'blob' }).toPromise() as Promise<Blob>;
    }
    // URL presigned MinIO/S3: fetch directo (no interpone token).
    const resp = await fetch(resolved);
    if (!resp.ok) {
      throw new Error(`No se pudo descargar el archivo (${resp.status})`);
    }
    return resp.blob();
  }
}