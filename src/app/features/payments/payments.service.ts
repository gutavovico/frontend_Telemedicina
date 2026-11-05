import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CheckoutResponse,
  CitaPendienteListResponse,
  EstadoPasarela,
  Pago,
  PagoListResponse,
} from './payments.models';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/pagos`;

  estadoPasarela(): Observable<EstadoPasarela> {
    return this.http.get<EstadoPasarela>(`${this.baseUrl}/estado-pasarela`);
  }

  listarPendientes(): Observable<CitaPendienteListResponse> {
    return this.http.get<CitaPendienteListResponse>(`${this.baseUrl}/pendientes`);
  }

  listarPagos(): Observable<PagoListResponse> {
    return this.http.get<PagoListResponse>(`${this.baseUrl}/mis-pagos`);
  }

  crearCheckout(idCita: number, canal: 'WEB' | 'MOVIL' = 'WEB'): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${this.baseUrl}/checkout`, {
      id_cita: idCita,
      canal,
      metodo_pago: 'TARJETA',
    });
  }

  obtenerPago(idPago: number): Observable<Pago> {
    return this.http.get<Pago>(`${this.baseUrl}/${idPago}`);
  }

  sincronizar(idPago: number): Observable<Pago> {
    return this.http.post<Pago>(`${this.baseUrl}/${idPago}/sincronizar`, {});
  }

  simularPago(idPago: number): Observable<Pago> {
    return this.http.post<Pago>(`${this.baseUrl}/${idPago}/simular-pago`, {});
  }

  descargarComprobante(idPago: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/${idPago}/comprobante/pdf`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  descargarQr(idPago: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${idPago}/qr`, { responseType: 'blob' });
  }
}
