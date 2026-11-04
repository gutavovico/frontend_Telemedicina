import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  EspecialidadItem,
  EspecialistaItem,
  SpecialistSearchFilters,
  SpecialistSearchResponse,
} from '../models/specialist-search.model';

@Injectable({
  providedIn: 'root',
})
export class SpecialistSearchService {
  private readonly http: HttpClient;
  private readonly apiUrl: string;

  constructor(http?: HttpClient) {
    this.http = http ?? inject(HttpClient);
    this.apiUrl = environment.apiUrl;
  }

  listarEspecialidades(): Observable<EspecialidadItem[]> {
    return this.http.get<EspecialidadItem[]>(`${this.apiUrl}/especialidades`);
  }

  buscarEspecialistas(filtros: SpecialistSearchFilters): Observable<SpecialistSearchResponse> {
    let params = new HttpParams()
      .set('fecha_inicio', filtros.fecha_inicio)
      .set('fecha_fin', filtros.fecha_fin)
      .set('modalidad', filtros.modalidad || 'AMBAS')
      .set('page', (filtros.page || 1).toString())
      .set('per_page', (filtros.per_page || 20).toString());

    if (filtros.nombre && filtros.nombre.trim()) {
      params = params.set('nombre', filtros.nombre.trim());
    }
    if (filtros.especialidad_id) {
      params = params.set('especialidad_id', filtros.especialidad_id.toString());
    }
    if (filtros.costo_min !== undefined && filtros.costo_min !== null) {
      params = params.set('costo_min', filtros.costo_min.toString());
    }
    if (filtros.costo_max !== undefined && filtros.costo_max !== null) {
      params = params.set('costo_max', filtros.costo_max.toString());
    }

    return this.http.get<SpecialistSearchResponse>(`${this.apiUrl}/especialistas/buscar`, {
      params,
    });
  }

  obtenerDisponibilidad(
    idMedico: number,
    fechaInicio: string,
    fechaFin: string,
    idServicio?: number,
  ): Observable<EspecialistaItem> {
    let params = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (idServicio) {
      params = params.set('id_servicio', idServicio.toString());
    }

    return this.http.get<EspecialistaItem>(
      `${this.apiUrl}/especialistas/${idMedico}/disponibilidad`,
      { params },
    );
  }
}
