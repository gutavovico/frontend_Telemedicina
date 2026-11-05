/**
 * Contrato TypeScript CU17: Tratamientos médicos.
 * Refleja fielmente specs/openspec/contracts/treatments.md.
 */

export type EstadoPlan = 'ACTIVO' | 'FINALIZADO' | 'SUSPENDIDO_POR_RECETA';

export type EstadoMedicamentoPlan = 'ACTIVO' | 'SUSPENDIDO';

export type EstadoDosis = 'PENDIENTE' | 'INGERIDA' | 'OMITIDA' | 'POSPUESTA';

export type NivelAdherencia = 'SIN_DATOS' | 'OPTIMA' | 'REGULAR' | 'CRITICA';

export type TipoAviso = 'RECORDATORIO' | 'OMISION' | 'RIESGO_ABANDONO';

export type CanalAviso = 'WEB' | 'PUSH';

export type EstadoAviso = 'PENDIENTE' | 'ENVIADO' | 'FALLIDO';

export interface DiagnosticoPlan {
  codigo_cie: string;
  descripcion: string;
}

export interface Adherencia {
  numerador_puntual: number;
  denominador_programado: number;
  porcentaje: number | null;
  nivel: NivelAdherencia;
  calculado_en: string;
}

export interface MedicamentoPlan {
  id_medicamento_plan: number;
  id_receta_detalle: number;
  medicamento_nombre: string;
  dosis: string;
  via_administracion: string;
  frecuencia_texto_receta: string;
  duracion_texto_receta: string;
  indicaciones: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  horas_locales: string[];
  intervalo_horas: number | null;
  estado: EstadoMedicamentoPlan;
}

export interface Plan {
  id_tratamiento: number;
  id_clinica: number;
  id_consulta: number;
  id_receta: number | null;
  id_diagnostico: number;
  diagnostico: DiagnosticoPlan | null;
  id_paciente: number;
  id_medico: number;
  fecha_inicio: string;
  fecha_fin: string;
  zona_horaria: string;
  estado: EstadoPlan;
  notas: string | null;
  motivo_cierre: string | null;
  medicamentos: MedicamentoPlan[];
  created_at: string;
  updated_at: string;
  adherencia: Adherencia;
}

export interface Dosis {
  id_dosis: number;
  id_medicamento_plan: number;
  programada_en: string;
  programada_hora_local: string;
  zona_horaria: string;
  estado: EstadoDosis;
  vencida: boolean;
  efectiva_en: string | null;
  registrada_en: string | null;
  puntual: boolean;
  nota: string | null;
}

export interface CronogramaDia {
  id_tratamiento: number;
  fecha: string;
  zona_horaria: string;
  dosis: Dosis[];
  adherencia: Adherencia;
}

export interface Aviso {
  id_aviso: number;
  id_tratamiento: number;
  id_dosis: number;
  tipo: TipoAviso;
  canal: CanalAviso;
  titulo: string;
  mensaje: string;
  estado: EstadoAviso;
  programada_en: string;
  enviada_en: string | null;
  leida_en: string | null;
}

export interface PlanListResponse {
  items: Plan[];
  total: number;
}

export interface AvisoListResponse {
  items: Aviso[];
  total: number;
}

export interface MedicamentoPlanCreate {
  id_receta_detalle: number;
  fecha_inicio: string;
  fecha_fin: string;
  horas_locales: string[];
  indicaciones?: string | null;
}

export interface PlanCreate {
  id_consulta: number;
  id_receta?: number | null;
  id_diagnostico?: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  zona_horaria: string;
  notas?: string | null;
  medicamentos: MedicamentoPlanCreate[];
}

export interface RegistroDosis {
  estado: 'INGERIDA' | 'OMITIDA' | 'POSPUESTA';
  efectiva_en?: string | null;
  nota?: string | null;
}

export interface EvolucionCreate {
  nota: string;
}

export interface MotivoClinico {
  motivo: string;
}

export interface MedicamentoVigencia {
  id_medicamento_plan: number;
  fecha_fin: string;
}

export interface VigenciaUpdate {
  fecha_fin: string;
  motivo: string;
  medicamentos?: MedicamentoVigencia[];
}

export interface PlanQueryParams {
  skip?: number;
  limit?: number;
  estado?: EstadoPlan;
  id_paciente?: number;
}

export interface AvisoQueryParams {
  skip?: number;
  limit?: number;
  no_leidos?: boolean;
}

export interface IntentoDosisCreate {
  request_hash: string;
}

export interface ConsultaIdempotenciaResponse {
  id_dosis: number;
  idempotency_key: string;
  estado: 'CONFIRMADA' | 'EN_CURSO' | 'RECHAZADA' | 'NO_INICIADA';
  confirmado: boolean;
  en_curso: boolean;
  rechazado: boolean;
  dosis: Dosis | null;
  mensaje?: string | null;
  generacion?: number;
}
