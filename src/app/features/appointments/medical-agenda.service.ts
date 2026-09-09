import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AccionBloqueoResponse, BloqueoAgenda, BloqueoCreate, DisponibilidadAgenda,
  EstadoHorario, HorarioAgenda, HorarioCreate, ServicioAgenda, SesionAgenda
} from './medical-agenda.models';

@Injectable({ providedIn: 'root' })
export class MedicalAgendaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/appointments/agenda`;

  getSesion() { return this.http.get<SesionAgenda>(`${environment.apiUrl}/auth/me`); }
  getServicios() { return this.http.get<ServicioAgenda[]>(`${this.base}/servicios`); }
  getHorarios(idMedico?: number) {
    return this.http.get<HorarioAgenda[]>(`${this.base}/horarios`, { params: this.medicoParams(idMedico) });
  }
  createHorario(payload: HorarioCreate) { return this.http.post<HorarioAgenda>(`${this.base}/horarios`, payload); }
  updateHorarioEstado(id: number, estado: EstadoHorario) {
    return this.http.patch<HorarioAgenda>(`${this.base}/horarios/${id}/estado`, { estado });
  }
  getBloqueos(idMedico?: number) {
    return this.http.get<BloqueoAgenda[]>(`${this.base}/bloqueos`, { params: this.medicoParams(idMedico) });
  }
  createBloqueo(payload: BloqueoCreate) { return this.http.post<BloqueoAgenda>(`${this.base}/bloqueos`, payload); }
  aprobarBloqueo(id: number) { return this.http.patch<AccionBloqueoResponse>(`${this.base}/bloqueos/${id}/aprobar`, {}); }
  rechazarBloqueo(id: number) { return this.http.patch<AccionBloqueoResponse>(`${this.base}/bloqueos/${id}/rechazar`, {}); }
  liberarBloqueo(id: number) { return this.http.patch<AccionBloqueoResponse>(`${this.base}/bloqueos/${id}/liberar`, {}); }
  getDisponibilidad(idMedico: number, fecha: string, idServicio: number) {
    const params = new HttpParams().set('id_medico', idMedico).set('fecha', fecha).set('id_servicio', idServicio);
    return this.http.get<DisponibilidadAgenda>(`${this.base}/disponibilidad`, { params });
  }
  private medicoParams(id?: number) { return id === undefined ? new HttpParams() : new HttpParams().set('id_medico', id); }
}
