import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  OpcionesPlanes,
  Pagina,
  Plan,
  PlanCreate,
  VersionCreate,
  VersionPlan,
} from '../models/plan.models';

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/planes`;
  opciones() {
    return this.http.get<OpcionesPlanes>(`${this.url}/opciones`);
  }
  listar(q = '', estado = '', page = 1) {
    let params = new HttpParams().set('q', q).set('page', page).set('per_page', 10);
    if (estado) params = params.set('estado', estado);
    return this.http.get<Pagina<Plan>>(this.url, { params });
  }
  detalle(id: number) {
    return this.http.get<Plan>(`${this.url}/${id}`);
  }
  crear(data: PlanCreate) {
    return this.http.post<Plan>(this.url, data);
  }
  nuevaVersion(id: number, data: VersionCreate) {
    return this.http.post<Plan>(`${this.url}/${id}/versiones`, data);
  }
  historial(id: number, page = 1) {
    return this.http.get<Pagina<VersionPlan>>(`${this.url}/${id}/versiones`, {
      params: { page, per_page: 10 },
    });
  }
  version(id: number, numero: number) {
    return this.http.get<VersionPlan>(`${this.url}/${id}/versiones/${numero}`);
  }
  desactivar(id: number) {
    return this.http.patch<Plan>(`${this.url}/${id}/estado`, { activo: false });
  }
}
