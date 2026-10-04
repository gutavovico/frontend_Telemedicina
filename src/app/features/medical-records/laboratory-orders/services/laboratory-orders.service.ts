import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  ExamenCatalogoResponse,
  ExamenOrdenRequest,
  ExamenOrdenResponse,
  OrdenLaboratorioCreateRequest,
  OrdenLaboratorioDownloadResponse,
  OrdenLaboratorioListResponse,
  OrdenLaboratorioPaginationResponse,
  OrdenLaboratorioQueryParams,
  OrdenLaboratorioResponse,
  OrdenLaboratorioFirmarRequest
} from '../models/laboratory-order.models';

@Injectable({
  providedIn: 'root'
})
export class LaboratoryOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/ordenes-laboratorio`;

  readonly orders = signal<OrdenLaboratorioListResponse[]>([]);
  readonly selectedOrder = signal<OrdenLaboratorioResponse | null>(null);
  readonly catalogo = signal<ExamenOrdenResponse[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly totalRecords = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly currentPage = signal<number>(1);

  private buildParams(params: OrdenLaboratorioQueryParams = {}): HttpParams {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 1).toString())
      .set('page_size', (params.page_size ?? 10).toString());

    if (params.estado) httpParams = httpParams.set('estado', params.estado);
    if (params.id_paciente != null) httpParams = httpParams.set('id_paciente', params.id_paciente.toString());
    if (params.fecha_desde) httpParams = httpParams.set('fecha_desde', params.fecha_desde);
    if (params.fecha_hasta) httpParams = httpParams.set('fecha_hasta', params.fecha_hasta);
    if (params.q && params.q.trim()) httpParams = httpParams.set('q', params.q.trim());
    return httpParams;
  }

  getCatalogo(): Observable<ExamenOrdenResponse[]> {
    return this.http.get<ExamenCatalogoResponse[]>(`${this.baseUrl}/examenes`).pipe(
      tap({
        next: (examenes) => {
          this.catalogo.set(
            examenes.map(e => ({
              codigo: e.codigo,
              nombre: e.nombre,
              indicaciones: undefined
            }))
          );
        }
      })
    );
  }

  getOrders(params: OrdenLaboratorioQueryParams = {}): Observable<OrdenLaboratorioPaginationResponse> {
    this.isLoading.set(true);
    return this.http.get<OrdenLaboratorioPaginationResponse>(this.baseUrl, { params: this.buildParams(params) }).pipe(
      tap({
        next: (res) => {
          this.orders.set(res.items);
          this.totalRecords.set(res.total);
          this.totalPages.set(res.total_pages);
          this.currentPage.set(res.page);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  getOrderById(id: number): Observable<OrdenLaboratorioResponse> {
    this.isLoading.set(true);
    return this.http.get<OrdenLaboratorioResponse>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: (order) => {
          this.selectedOrder.set(order);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  createDraft(data: OrdenLaboratorioCreateRequest): Observable<OrdenLaboratorioResponse> {
    this.isLoading.set(true);
    return this.http.post<OrdenLaboratorioResponse>(this.baseUrl, data).pipe(
      tap({
        next: (order) => {
          // Convertir a formato de lista para el estado reactivo
          const listItem = {
            id_orden: order.id_orden,
            id_clinica: order.id_clinica,
            id_paciente: order.id_paciente,
            paciente_nombre: order.paciente_nombre,
            examenes_codigos: order.examenes.map(e => e.codigo),
            estado: order.estado,
            fecha_orden: order.fecha_orden,
            created_at: order.created_at
          };
          this.orders.update((prev) => [listItem, ...prev]);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  firmarOrden(id: number, _data: OrdenLaboratorioFirmarRequest = {}): Observable<OrdenLaboratorioResponse> {
    this.isLoading.set(true);
    return this.http.post<OrdenLaboratorioResponse>(`${this.baseUrl}/${id}/firmar`, {}).pipe(
      tap({
        next: (order) => {
          this.selectedOrder.set(order);
          this.orders.update((prev) =>
            prev.map((o) => (o.id_orden === id ? { ...o, estado: 'FIRMADA', firma_digital: order.firma_digital, archivo_url: order.archivo_url, hash_archivo: order.hash_archivo } : o))
          );
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  downloadOrder(id: number): Observable<OrdenLaboratorioDownloadResponse> {
    return this.http.get<OrdenLaboratorioDownloadResponse>(`${this.baseUrl}/${id}/download`);
  }

  async loadDocumentBlob(urlFirmada: string): Promise<Blob> {
    const isLocal = urlFirmada.includes(environment.apiUrl) || urlFirmada.startsWith('/');
    const resolved = isLocal
      ? urlFirmada.startsWith('http') ? urlFirmada : `${environment.apiUrl}${urlFirmada}`
      : urlFirmada;

    if (isLocal) {
      return this.http.get(resolved, { responseType: 'blob' }).toPromise() as Promise<Blob>;
    }
    const resp = await fetch(resolved);
    if (!resp.ok) {
      throw new Error(`No se pudo descargar el archivo (${resp.status})`);
    }
    return resp.blob();
  }
}