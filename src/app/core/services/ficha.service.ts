import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FichaCancelRequest,
  FichaClinica,
  FichaClinicaUpdateRequest,
  FichaCreateRequest,
  FichaListResponse,
} from '../models/ficha.models';

@Injectable({
  providedIn: 'root',
})
export class FichaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/medical-records/fichas`;

  // Signals reactivos
  readonly fichas = signal<FichaClinica[]>([]);
  readonly selectedFicha = signal<FichaClinica | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly totalRecords = signal<number>(0);

  listarFichas(
    idPaciente?: number,
    idMedico?: number,
    idEspecialidad?: number,
    fecha?: string,
    estado?: string,
    skip: number = 0,
    limit: number = 50
  ): Observable<FichaListResponse> {
    this.isLoading.set(true);
    let params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());

    if (idPaciente) params = params.set('id_paciente', idPaciente.toString());
    if (idMedico) params = params.set('id_medico', idMedico.toString());
    if (idEspecialidad) params = params.set('id_especialidad', idEspecialidad.toString());
    if (fecha) params = params.set('fecha', fecha);
    if (estado && estado !== 'TODOS') params = params.set('estado', estado);

    return this.http.get<FichaListResponse>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this.fichas.set(res.items);
          this.totalRecords.set(res.total);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      })
    );
  }

  obtenerFicha(idFicha: string): Observable<FichaClinica> {
    this.isLoading.set(true);
    return this.http.get<FichaClinica>(`${this.baseUrl}/${idFicha}`).pipe(
      tap({
        next: (res) => {
          this.selectedFicha.set(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      })
    );
  }

  emitirFicha(payload: FichaCreateRequest): Observable<FichaClinica> {
    this.isLoading.set(true);
    return this.http.post<FichaClinica>(this.baseUrl, payload).pipe(
      tap({
        next: (res) => {
          this.fichas.update((prev) => [res, ...prev]);
          this.totalRecords.update((c) => c + 1);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      })
    );
  }

  actualizarClinica(idFicha: string, payload: FichaClinicaUpdateRequest): Observable<FichaClinica> {
    this.isLoading.set(true);
    return this.http.patch<FichaClinica>(`${this.baseUrl}/${idFicha}/clinica`, payload).pipe(
      tap({
        next: (res) => {
          this.selectedFicha.set(res);
          this.fichas.update((prev) =>
            prev.map((item) => (item.id_ficha === idFicha ? res : item))
          );
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      })
    );
  }

  cancelarFicha(idFicha: string, motivo: string): Observable<FichaClinica> {
    this.isLoading.set(true);
    const body: FichaCancelRequest = { motivo_cancelacion: motivo };
    return this.http.post<FichaClinica>(`${this.baseUrl}/${idFicha}/cancelar`, body).pipe(
      tap({
        next: (res) => {
          this.selectedFicha.set(res);
          this.fichas.update((prev) =>
            prev.map((item) => (item.id_ficha === idFicha ? res : item))
          );
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      })
    );
  }
}
