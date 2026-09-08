import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClinicaEstadoResponse,
  ClinicaEstadoUpdate,
  ClinicaListResponse
} from '../models/tenant.models';

@Injectable({
  providedIn: 'root'
})
export class ClinicasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listClinicas(estado?: string, page = 1, perPage = 20): Observable<ClinicaListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (estado) {
      params = params.set('estado', estado);
    }

    return this.http.get<ClinicaListResponse>(`${this.apiUrl}/api/v1/clinicas`, { params });
  }

  updateEstado(clinicaId: number, estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO'): Observable<ClinicaEstadoResponse> {
    const payload: ClinicaEstadoUpdate = { estado };
    return this.http.patch<ClinicaEstadoResponse>(
      `${this.apiUrl}/api/v1/clinicas/${clinicaId}/estado`,
      payload
    );
  }
}
