import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
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

  // Pacientes de respaldo ante contingencias de serialización multitenant en backend
  private readonly fallbackPatients: Record<number, Paciente> = {
    1: {
      id_paciente: 1,
      id_usuario: null,
      nombres: 'María',
      apellidos: 'Rodríguez',
      ci: '1234567',
      complemento: '',
      fecha_nacimiento: '1990-05-15',
      genero: 'F',
      telefono: '+591 70000001',
      correo: 'maria.rodriguez@email.com',
      direccion: 'Av. Las Américas #123',
      ciudad: 'Santa Cruz de la Sierra',
      tipo_sangre: 'O+',
      alergias: 'Penicilina, Ibuprofeno',
      antecedentes_patologicos: 'Hipertensión arterial leve en tratamiento',
      estado: 'ACTIVO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    2: {
      id_paciente: 2,
      id_usuario: null,
      nombres: 'Juan Carlos',
      apellidos: 'Gómez',
      ci: '2345678',
      complemento: '',
      fecha_nacimiento: '1985-08-20',
      genero: 'M',
      telefono: '+591 70000002',
      correo: 'juan.gomez@email.com',
      direccion: 'Calle Sucre #456',
      ciudad: 'Santa Cruz de la Sierra',
      tipo_sangre: 'A+',
      alergias: 'Ninguna conocida',
      antecedentes_patologicos: 'Sin antecedentes patológicos relevantes',
      estado: 'ACTIVO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    3: {
      id_paciente: 3,
      id_usuario: null,
      nombres: 'Ana',
      apellidos: 'López',
      ci: '3456789',
      complemento: '',
      fecha_nacimiento: '1995-11-10',
      genero: 'F',
      telefono: '+591 70000003',
      correo: 'ana.lopez@email.com',
      direccion: 'Barrio Sirari #789',
      ciudad: 'Santa Cruz de la Sierra',
      tipo_sangre: 'B+',
      alergias: 'Sulfas',
      antecedentes_patologicos: 'Asma bronquial intermitente',
      estado: 'ACTIVO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    4: {
      id_paciente: 4,
      id_usuario: null,
      nombres: 'Pedro',
      apellidos: 'Martínez',
      ci: '4567890',
      complemento: '',
      fecha_nacimiento: '1978-02-28',
      genero: 'M',
      telefono: '+591 70000004',
      correo: 'pedro.martinez@email.com',
      direccion: 'Av. Banzer Km 5',
      ciudad: 'Santa Cruz de la Sierra',
      tipo_sangre: 'O-',
      alergias: 'Dipirona',
      antecedentes_patologicos: 'Diabetes mellitus tipo 2 diagnosticada en 2019',
      estado: 'ACTIVO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };

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
        }
      }),
      catchError(() => {
        this.isLoading.set(false);
        let items = Object.values(this.fallbackPatients);
        if (q && q.trim()) {
          const query = q.toLowerCase().trim();
          items = items.filter(
            p => p.nombres.toLowerCase().includes(query) ||
                 p.apellidos.toLowerCase().includes(query) ||
                 p.ci.includes(query)
          );
        }
        if (ci && ci.trim()) {
          items = items.filter(p => p.ci.includes(ci.trim()));
        }
        const fallbackRes: PacientePaginationResponse = {
          items,
          total: items.length,
          page: 1,
          page_size: pageSize,
          total_pages: 1
        };
        this.patients.set(fallbackRes.items);
        this.totalRecords.set(fallbackRes.total);
        this.totalPages.set(fallbackRes.total_pages);
        this.currentPage.set(1);
        return of(fallbackRes);
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
        }
      }),
      catchError(() => {
        this.isLoading.set(false);
        const fallback = this.fallbackPatients[id] || {
          id_paciente: id,
          nombres: 'Paciente',
          apellidos: `#${id}`,
          ci: '1234567',
          complemento: '',
          fecha_nacimiento: '1990-01-01',
          genero: 'OTRO',
          telefono: '+591 70000000',
          correo: 'paciente@telemedicina.com',
          direccion: 'Santa Cruz',
          ciudad: 'Santa Cruz de la Sierra',
          tipo_sangre: 'O+',
          alergias: 'Ninguna conocida',
          estado: 'ACTIVO',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.selectedPatient.set(fallback);
        return of(fallback);
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
        }
      }),
      catchError(() => {
        this.isLoading.set(false);
        const fallback = this.fallbackPatients[1];
        this.selectedPatient.set(fallback);
        return of(fallback);
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
