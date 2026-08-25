import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Paciente,
  PacienteCreateRequest,
  PacienteUpdateRequest,
  PacienteProfilePatchRequest,
  PacientePaginationResponse
} from '../models/patient.models';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/pacientes`;

  // Signals reactivos para gestión de estado
  readonly patients = signal<Paciente[]>([]);
  readonly selectedPatient = signal<Paciente | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly totalRecords = signal<number>(0);
  readonly totalPages = signal<number>(1);
  readonly currentPage = signal<number>(1);

  /**
   * Obtiene la lista paginada de pacientes con filtros de búsqueda
   */
  getPatients(
    page: number = 1,
    pageSize: number = 10,
    q?: string,
    ci?: string,
    estado: string = 'ACTIVO'
  ): Observable<PacientePaginationResponse> {
    this.isLoading.set(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString())
      .set('estado', estado);

    if (q && q.trim()) {
      params = params.set('q', q.trim());
    }
    if (ci && ci.trim()) {
      params = params.set('ci', ci.trim());
    }

    return this.http.get<PacientePaginationResponse>(this.baseUrl, { params }).pipe(
      tap({
        next: (res) => {
          this.patients.set(res.items);
          this.totalRecords.set(res.total);
          this.totalPages.set(res.total_pages);
          this.currentPage.set(res.page);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Obtiene el expediente de un paciente por su ID
   */
  getPatientById(id: number): Observable<Paciente> {
    this.isLoading.set(true);
    return this.http.get<Paciente>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: (patient) => {
          this.selectedPatient.set(patient);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Obtiene el perfil propio del paciente autenticado
   */
  getMyProfile(): Observable<Paciente> {
    this.isLoading.set(true);
    return this.http.get<Paciente>(`${this.baseUrl}/me`).pipe(
      tap({
        next: (patient) => {
          this.selectedPatient.set(patient);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Registra un nuevo paciente
   */
  createPatient(data: PacienteCreateRequest): Observable<Paciente> {
    this.isLoading.set(true);
    return this.http.post<Paciente>(this.baseUrl, data).pipe(
      tap({
        next: (newPatient) => {
          this.patients.update((prev) => [newPatient, ...prev]);
          this.totalRecords.update((t) => t + 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Actualiza el expediente de un paciente por ID
   */
  updatePatient(id: number, data: PacienteUpdateRequest): Observable<Paciente> {
    this.isLoading.set(true);
    return this.http.put<Paciente>(`${this.baseUrl}/${id}`, data).pipe(
      tap({
        next: (updated) => {
          this.patients.update((prev) =>
            prev.map((p) => (p.id_paciente === id ? updated : p))
          );
          if (this.selectedPatient()?.id_paciente === id) {
            this.selectedPatient.set(updated);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Actualiza los datos de contacto y emergencia propios del paciente
   */
  patchMyProfile(data: PacienteProfilePatchRequest): Observable<Paciente> {
    this.isLoading.set(true);
    return this.http.patch<Paciente>(`${this.baseUrl}/me`, data).pipe(
      tap({
        next: (updated) => {
          this.selectedPatient.set(updated);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Realiza la baja lógica de un paciente
   */
  deletePatient(id: number): Observable<{ detail: string; id_paciente: number; estado: string }> {
    this.isLoading.set(true);
    return this.http.delete<{ detail: string; id_paciente: number; estado: string }>(`${this.baseUrl}/${id}`).pipe(
      tap({
        next: () => {
          this.patients.update((prev) => prev.filter((p) => p.id_paciente !== id));
          this.totalRecords.update((t) => Math.max(0, t - 1));
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }
}
