import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsignacionEspecialidad,
  EspecialidadCreate,
  EspecialidadResponse,
  EstadoUpdate,
  MedicoCreate,
  MedicoListFilters,
  MedicoListResponse,
  MedicoResponse,
  MedicoUpdate
} from '../models/medico.models';

@Injectable({
  providedIn: 'root'
})
export class MedicoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listarMedicos(filtros: MedicoListFilters): Observable<MedicoListResponse> {
    let params = new HttpParams();
    if (filtros.nombre) {
      params = params.set('nombre', filtros.nombre);
    }
    if (filtros.id_especialidad) {
      params = params.set('id_especialidad', filtros.id_especialidad.toString());
    }
    if (filtros.estado) {
      params = params.set('estado', filtros.estado);
    }
    if (filtros.skip !== undefined) {
      params = params.set('skip', filtros.skip.toString());
    }
    if (filtros.limit !== undefined) {
      params = params.set('limit', filtros.limit.toString());
    }
    return this.http.get<MedicoListResponse>(`${this.apiUrl}/medicos`, { params });
  }

  obtenerMiPerfil(): Observable<MedicoResponse> {
    return this.http.get<MedicoResponse>(`${this.apiUrl}/medicos/me`);
  }

  obtenerMedico(idMedico: number): Observable<MedicoResponse> {
    return this.http.get<MedicoResponse>(`${this.apiUrl}/medicos/${idMedico}`);
  }

  crearMedico(datos: MedicoCreate): Observable<MedicoResponse> {
    return this.http.post<MedicoResponse>(`${this.apiUrl}/medicos`, datos);
  }

  actualizarMedico(idMedico: number, datos: MedicoUpdate): Observable<MedicoResponse> {
    return this.http.put<MedicoResponse>(`${this.apiUrl}/medicos/${idMedico}`, datos);
  }

  cambiarEstado(idMedico: number, nuevoEstado: string): Observable<MedicoResponse> {
    const payload: EstadoUpdate = { nuevo_estado: nuevoEstado };
    return this.http.patch<MedicoResponse>(`${this.apiUrl}/medicos/${idMedico}/estado`, payload);
  }

  asignarEspecialidad(idMedico: number, asignacion: AsignacionEspecialidad): Observable<MedicoResponse> {
    return this.http.post<MedicoResponse>(`${this.apiUrl}/medicos/${idMedico}/especialidades`, asignacion);
  }

  quitarEspecialidad(idMedico: number, idEspecialidad: number): Observable<MedicoResponse> {
    return this.http.delete<MedicoResponse>(`${this.apiUrl}/medicos/${idMedico}/especialidades/${idEspecialidad}`);
  }

  listarEspecialidades(): Observable<EspecialidadResponse[]> {
    return this.http.get<EspecialidadResponse[]>(`${this.apiUrl}/especialidades`);
  }

  crearEspecialidad(datos: EspecialidadCreate): Observable<EspecialidadResponse> {
    return this.http.post<EspecialidadResponse>(`${this.apiUrl}/especialidades`, datos);
  }
}
