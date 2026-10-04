import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  Medicamento,
  MedicamentoCreateRequest,
  MedicamentoListResponse,
  MedicamentoQueryParams,
  RecetaAnulacionRequest,
  RecetaCreateRequest,
  RecetaListResponse,
  RecetaQueryParams,
  RecetaResponse,
  RecetaValidacionPublicaResponse,
  extraerNombrePdfDesdeContentDisposition,
} from '../models/prescription.models';

@Injectable({
  providedIn: 'root',
})
export class PrescriptionsService {
  private readonly http = inject(HttpClient);
  private readonly medicamentosUrl = `${environment.apiUrl}/api/v1/medicamentos`;
  private readonly recetasUrl = `${environment.apiUrl}/api/v1/recetas`;

  private buildMedicamentoParams(params: MedicamentoQueryParams = {}): HttpParams {
    let httpParams = new HttpParams()
      .set('skip', (params.skip ?? 0).toString())
      .set('limit', (params.limit ?? 50).toString());
    if (params.query !== undefined && params.query.trim() !== '') {
      httpParams = httpParams.set('query', params.query.trim());
    }
    if (params.estado !== undefined && params.estado.trim() !== '') {
      httpParams = httpParams.set('estado', params.estado.trim());
    }
    return httpParams;
  }

  private buildRecetaParams(params: RecetaQueryParams = {}): HttpParams {
    let httpParams = new HttpParams()
      .set('skip', (params.skip ?? 0).toString())
      .set('limit', (params.limit ?? 50).toString());
    if (params.id_paciente !== undefined && params.id_paciente !== null) {
      httpParams = httpParams.set('id_paciente', params.id_paciente.toString());
    }
    if (params.id_medico !== undefined && params.id_medico !== null) {
      httpParams = httpParams.set('id_medico', params.id_medico.toString());
    }
    if (params.estado !== undefined && params.estado !== null) {
      httpParams = httpParams.set('estado', params.estado);
    }
    if (params.desde !== undefined && params.desde !== '') {
      httpParams = httpParams.set('desde', params.desde);
    }
    if (params.hasta !== undefined && params.hasta !== '') {
      httpParams = httpParams.set('hasta', params.hasta);
    }
    return httpParams;
  }

  /** 1. Buscar medicamentos (MEDICO o ADMIN con lectura). */
  searchMedicines(params: MedicamentoQueryParams = {}): Observable<MedicamentoListResponse> {
    return this.http.get<MedicamentoListResponse>(this.medicamentosUrl, {
      params: this.buildMedicamentoParams(params),
    });
  }

  /** 2. Crear medicamento (ADMIN + prescriptions:catalog:write). */
  createMedicine(payload: MedicamentoCreateRequest): Observable<Medicamento> {
    return this.http.post<Medicamento>(this.medicamentosUrl, payload);
  }

  /** 3. Emitir receta con Idempotency-Key. 201 = creada, 200 = reintento idempotente. */
  issuePrescription(
    payload: RecetaCreateRequest,
    idempotencyKey: string,
  ): Observable<HttpResponse<RecetaResponse>> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<RecetaResponse>(this.recetasUrl, payload, {
      headers,
      observe: 'response',
    });
  }

  /** 4. Listar recetas con skip/limit. El alcance lo resuelve el backend. */
  listPrescriptions(params: RecetaQueryParams = {}): Observable<RecetaListResponse> {
    return this.http.get<RecetaListResponse>(this.recetasUrl, {
      params: this.buildRecetaParams(params),
    });
  }

  /** 5. Detalle de receta. */
  getPrescription(id: number): Observable<RecetaResponse> {
    return this.http.get<RecetaResponse>(`${this.recetasUrl}/${id}`);
  }

  /** 6. Descargar PDF legal como Blob con cabeceras para el nombre seguro. */
  downloadPdf(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.recetasUrl}/${id}/pdf`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  /** 7. Anular receta con motivo, observaciones y sustituta opcional. */
  cancelPrescription(id: number, payload: RecetaAnulacionRequest): Observable<RecetaResponse> {
    return this.http.post<RecetaResponse>(`${this.recetasUrl}/${id}/anular`, payload);
  }

  /** 8. Validación pública sin sesión. No persiste el código. */
  validatePublic(codigo: string): Observable<RecetaValidacionPublicaResponse> {
    const headers = new HttpHeaders({ 'Cache-Control': 'no-store' });
    const limpio = codigo.trim();
    return this.http.get<RecetaValidacionPublicaResponse>(
      `${this.recetasUrl}/validar/${encodeURIComponent(limpio)}`,
      { headers },
    );
  }

  resolvePdfFilename(response: HttpResponse<Blob>, fallback: string): string {
    const header = response.headers.get('Content-Disposition');
    return extraerNombrePdfDesdeContentDisposition(header, fallback);
  }

  saveBlob(blob: Blob, filename: string): void {
    const objectUrl = window.URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      window.URL.revokeObjectURL(objectUrl);
    }
  }
}
