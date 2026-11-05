import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  Adherencia,
  ConsultaIdempotenciaResponse,
  IntentoDosisCreate,
  Aviso,
  AvisoListResponse,
  AvisoQueryParams,
  CronogramaDia,
  Dosis,
  EvolucionCreate,
  MotivoClinico,
  Plan,
  PlanCreate,
  PlanListResponse,
  PlanQueryParams,
  RegistroDosis,
  VigenciaUpdate,
} from '../models/treatment.models';

@Injectable({
  providedIn: 'root',
})
export class TreatmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/tratamientos`;

  /**
   * Consulta paginada de planes de tratamiento.
   * Filtra por paciente o médico según el usuario autenticado.
   */
  listPlans(params: PlanQueryParams = {}): Observable<PlanListResponse> {
    let httpParams = new HttpParams()
      .set('skip', (params.skip ?? 0).toString())
      .set('limit', (params.limit ?? 20).toString());

    if (params.estado) {
      httpParams = httpParams.set('estado', params.estado);
    }
    if (params.id_paciente !== undefined && params.id_paciente !== null) {
      httpParams = httpParams.set('id_paciente', params.id_paciente.toString());
    }

    return this.http.get<PlanListResponse>(this.baseUrl, { params: httpParams });
  }

  /**
   * Consulta un plan específico por ID (titular o médico tratante).
   */
  getPlan(idTratamiento: number): Observable<Plan> {
    return this.http.get<Plan>(`${this.baseUrl}/${idTratamiento}`);
  }

  /**
   * Creación de plan terapéutico por el médico tratante.
   */
  createPlan(payload: PlanCreate): Observable<Plan> {
    return this.http.post<Plan>(this.baseUrl, payload);
  }

  /**
   * Consulta el cronograma diario y adherencia para una fecha local (YYYY-MM-DD).
   */
  getCronograma(idTratamiento: number, fecha: string): Observable<CronogramaDia> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<CronogramaDia>(`${this.baseUrl}/${idTratamiento}/cronograma`, { params });
  }

  /**
   * Métrica de adherencia calculada del plan.
   */
  getAdherencia(idTratamiento: number): Observable<Adherencia> {
    return this.http.get<Adherencia>(`${this.baseUrl}/${idTratamiento}/adherencia`);
  }

  /**
   * Registro de ingesta, omisión o posposición de dosis por el paciente.
   * Requiere Idempotency-Key para garantizar atomicidad y prevenir duplicados.
   */
  registrarDosis(idDosis: number, payload: RegistroDosis, idempotencyKey: string): Observable<Dosis> {
    const headers = new HttpHeaders({
      'Idempotency-Key': idempotencyKey,
    });
    return this.http.post<Dosis>(`${this.baseUrl}/dosis/${idDosis}/registros`, payload, { headers });
  }

  /**
   * Consulta el estado de una operación de idempotencia para una dosis.
   * Permite resolver de forma inequívoca el resultado de una operación previa tras pérdida de sesión o recarga.
   */
  consultarIdempotencia(
    idDosis: number,
    idempotencyKey: string
  ): Observable<ConsultaIdempotenciaResponse> {
    return this.http.get<ConsultaIdempotenciaResponse>(
      `${this.baseUrl}/dosis/${idDosis}/registros/idempotencia/${idempotencyKey}`
    );
  }

  /**
   * Registra el inicio de un intento durable de toma con request_hash e Idempotency-Key.
   * Fase 1 del protocolo de registro para cerrar la carrera antes del envío clínico.
   */
  iniciarIntento(
    idDosis: number,
    requestHash: string,
    idempotencyKey: string
  ): Observable<ConsultaIdempotenciaResponse> {
    const headers = new HttpHeaders({
      'Idempotency-Key': idempotencyKey,
    });
    const body: IntentoDosisCreate = { request_hash: requestHash };
    return this.http.post<ConsultaIdempotenciaResponse>(
      `${this.baseUrl}/dosis/${idDosis}/intentos`,
      body,
      { headers }
    );
  }

  /**
   * Resuelve de forma explícita y segura una operación abandonada (caída o logout),
   * marcándola como rechazada en el servidor para desbloquear la dosis y permitir un nuevo registro.
   */
  resolverOperacionAbandonada(
    idDosis: number,
    idempotencyKey: string
  ): Observable<ConsultaIdempotenciaResponse> {
    return this.http.post<ConsultaIdempotenciaResponse>(
      `${this.baseUrl}/dosis/${idDosis}/registros/idempotencia/${idempotencyKey}/resolver`,
      {}
    );
  }

  /**
   * Nota clínica de evolución añadida por el médico tratante.
   */
  registrarEvolucion(idTratamiento: number, payload: EvolucionCreate): Observable<{ id_evento: number }> {
    return this.http.post<{ id_evento: number }>(`${this.baseUrl}/${idTratamiento}/evoluciones`, payload);
  }

  /**
   * Suspensión clínica de un medicamento del plan.
   */
  suspenderMedicamento(idTratamiento: number, idMedicamentoPlan: number, payload: MotivoClinico): Observable<Plan> {
    return this.http.post<Plan>(
      `${this.baseUrl}/${idTratamiento}/medicamentos/${idMedicamentoPlan}/suspender`,
      payload
    );
  }

  /**
   * Reactivación de un medicamento previamente suspendido.
   */
  reactivarMedicamento(idTratamiento: number, idMedicamentoPlan: number, payload: MotivoClinico): Observable<Plan> {
    return this.http.post<Plan>(
      `${this.baseUrl}/${idTratamiento}/medicamentos/${idMedicamentoPlan}/reactivar`,
      payload
    );
  }

  /**
   * Actualización de vigencia / prórroga del plan y sus fármacos.
   */
  actualizarVigencia(idTratamiento: number, payload: VigenciaUpdate): Observable<Plan> {
    return this.http.patch<Plan>(`${this.baseUrl}/${idTratamiento}/vigencia`, payload);
  }

  /**
   * Cierre / finalización definitiva del plan terapéutico.
   */
  finalizarPlan(idTratamiento: number, payload: MotivoClinico): Observable<Plan> {
    return this.http.post<Plan>(`${this.baseUrl}/${idTratamiento}/finalizar`, payload);
  }

  /**
   * Bandeja web de avisos y alertas del usuario autenticado.
   */
  listAvisos(params: AvisoQueryParams = {}): Observable<AvisoListResponse> {
    let httpParams = new HttpParams()
      .set('skip', (params.skip ?? 0).toString())
      .set('limit', (params.limit ?? 20).toString());

    if (params.no_leidos !== undefined) {
      httpParams = httpParams.set('no_leidos', params.no_leidos.toString());
    }

    return this.http.get<AvisoListResponse>(`${this.baseUrl}/avisos`, { params: httpParams });
  }

  /**
   * Marca un aviso como leído por su destinatario.
   */
  marcarAvisoLeido(idAviso: number): Observable<Aviso> {
    return this.http.patch<Aviso>(`${this.baseUrl}/avisos/${idAviso}/leer`, {});
  }
}
