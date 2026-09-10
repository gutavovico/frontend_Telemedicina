import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConsultaCreateRequest,
  ConsultaResponse,
  HistoriaClinicaCompletaResponse
} from '../models/hce.models';

@Injectable({
  providedIn: 'root'
})
export class HceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/hce`;

  // Signals reactivos para el estado del expediente y consultas
  readonly historiaActual = signal<HistoriaClinicaCompletaResponse | null>(null);
  readonly consultaActual = signal<ConsultaResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Obtiene la historia clínica consolidada del paciente con todas sus evoluciones
   */
  getHistoriaClinica(idPaciente: number): Observable<HistoriaClinicaCompletaResponse> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http
      .get<HistoriaClinicaCompletaResponse>(`${this.baseUrl}/pacientes/${idPaciente}`)
      .pipe(
        tap({
          next: (res) => {
            this.historiaActual.set(res);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.isLoading.set(false);
            const msg =
              err.status === 404
                ? 'El expediente clínico no existe o no pertenece a su centro médico.'
                : err.status === 403
                ? 'No tiene permisos para acceder al expediente de este paciente.'
                : 'Error al cargar el historial clínico del paciente.';
            this.errorMessage.set(msg);
          }
        })
      );
  }

  /**
   * Registra una nueva consulta médica estructurada (SOAP + signos vitales + CIE-10)
   */
  registrarConsulta(
    idPaciente: number,
    payload: ConsultaCreateRequest
  ): Observable<ConsultaResponse> {
    this.isSaving.set(true);
    this.errorMessage.set(null);

    return this.http
      .post<ConsultaResponse>(`${this.baseUrl}/pacientes/${idPaciente}/consultas`, payload)
      .pipe(
        tap({
          next: (res) => {
            this.consultaActual.set(res);
            this.isSaving.set(false);
            // Actualizar la historia en memoria si ya estaba cargada
            const historia = this.historiaActual();
            if (historia) {
              this.historiaActual.set({
                ...historia,
                consultas: [res, ...historia.consultas]
              });
            }
          },
          error: (err) => {
            this.isSaving.set(false);
            let msg = 'Error al registrar la consulta médica.';
            if (err.error && typeof err.error.detail === 'string') {
              msg = err.error.detail;
            } else if (err.status === 409) {
              msg = 'La cita médica ya fue finalizada o no puede ser atendida.';
            } else if (err.status === 403) {
              msg = 'Acceso denegado: Únicamente médicos autorizados pueden registrar actos clínicos.';
            } else if (err.status === 422) {
              msg = 'Datos biométricos o diagnósticos no válidos. Verifique el formulario.';
            }
            this.errorMessage.set(msg);
          }
        })
      );
  }

  /**
   * Obtiene el detalle individual de una consulta clínica específica
   */
  getConsultaById(idConsulta: number): Observable<ConsultaResponse> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http.get<ConsultaResponse>(`${this.baseUrl}/consultas/${idConsulta}`).pipe(
      tap({
        next: (res) => {
          this.consultaActual.set(res);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          const msg =
            err.status === 404
              ? 'La consulta médica no fue encontrada.'
              : 'Error al cargar el detalle de la consulta.';
          this.errorMessage.set(msg);
        }
      })
    );
  }

  limpiarEstado(): void {
    this.historiaActual.set(null);
    this.consultaActual.set(null);
    this.errorMessage.set(null);
  }
}
