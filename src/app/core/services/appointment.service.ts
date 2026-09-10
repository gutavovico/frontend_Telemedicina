import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Cita,
  CitaCreateRequest,
  CitaListResponse,
  CitaUpdateRequest,
  HorarioSlot
} from '../models/appointment.models';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/citas`;

  // Signals reactivos
  readonly citas = signal<Cita[]>([]);
  readonly selectedCita = signal<Cita | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly totalRecords = signal<number>(0);
  readonly currentPage = signal<number>(1);

  listarCitas(
    q?: string,
    fecha?: string,
    estado?: string,
    idMedico?: number,
    idPaciente?: number,
    page: number = 1,
    pageSize: number = 50
  ): Observable<CitaListResponse> {
    this.isLoading.set(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());

    if (q && q.trim()) {
      params = params.set('q', q.trim());
    }
    if (fecha) {
      params = params.set('fecha', fecha);
    }
    if (estado && estado !== 'TODOS') {
      params = params.set('estado', estado);
    }
    if (idMedico) {
      params = params.set('id_medico', idMedico.toString());
    }
    if (idPaciente) {
      params = params.set('id_paciente', idPaciente.toString());
    }

    return this.http.get<CitaListResponse>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this.citas.set(res.items);
          this.totalRecords.set(res.total);
          this.currentPage.set(res.page);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  obtenerCita(idCita: number): Observable<Cita> {
    return this.http.get<Cita>(`${this.baseUrl}/${idCita}`).pipe(
      tap((cita) => this.selectedCita.set(cita))
    );
  }

  crearCita(datos: CitaCreateRequest): Observable<Cita> {
    return this.http.post<Cita>(this.baseUrl, datos).pipe(
      tap((nuevaCita) => {
        // Añadir a la lista localmente en tiempo real
        this.citas.update((prev) => [nuevaCita, ...prev]);
        this.totalRecords.update((n) => n + 1);
      })
    );
  }

  actualizarCita(idCita: number, datos: CitaUpdateRequest): Observable<Cita> {
    return this.http.put<Cita>(`${this.baseUrl}/${idCita}`, datos).pipe(
      tap((citaActualizada) => {
        // Actualizar en la lista localmente en tiempo real
        this.citas.update((prev) =>
          prev.map((c) => (c.id_cita === idCita ? citaActualizada : c))
        );
        if (this.selectedCita()?.id_cita === idCita) {
          this.selectedCita.set(citaActualizada);
        }
      })
    );
  }

  eliminarCita(idCita: number): Observable<{ message: string; id_cita: number }> {
    return this.http.delete<{ message: string; id_cita: number }>(`${this.baseUrl}/${idCita}`).pipe(
      tap(() => {
        // Eliminar de la lista localmente en tiempo real
        this.citas.update((prev) => prev.filter((c) => c.id_cita !== idCita));
        this.totalRecords.update((n) => Math.max(0, n - 1));
        if (this.selectedCita()?.id_cita === idCita) {
          this.selectedCita.set(null);
        }
      })
    );
  }

  obtenerHorarios(idMedico: number, fecha: string): Observable<HorarioSlot[]> {
    const params = new HttpParams()
      .set('id_medico', idMedico.toString())
      .set('fecha', fecha);
    return this.http.get<HorarioSlot[]>(`${this.baseUrl}/horarios-disponibles`, { params });
  }
}

