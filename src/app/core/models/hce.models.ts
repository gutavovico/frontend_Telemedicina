export type TipoDiagnostico = 'PRESUNTIVO' | 'DEFINITIVO' | 'REPETITIVO';

export interface SignosVitales {
  frecuencia_cardiaca_lpm?: number | null;
  presion_sistolica_mmhg?: number | null;
  presion_diastolica_mmhg?: number | null;
  temperatura_corporal_c?: number | null;
  saturacion_oxigeno_pct?: number | null;
  peso_kg?: number | null;
  talla_cm?: number | null;
  indice_masa_corporal?: number | null;
}

export interface DiagnosticoCreate {
  codigo_cie: string;
  descripcion: string;
  tipo: TipoDiagnostico;
  observaciones?: string | null;
}

export interface DiagnosticoResponse extends DiagnosticoCreate {
  id_diagnostico: number;
  fecha_registro: string;
}

export interface ConsultaCreateRequest {
  id_cita: number;
  motivo_consulta: string;
  sintomas: string;
  examen_fisico?: string | null;
  signos_vitales?: SignosVitales | null;
  observaciones?: string | null;
  evolucion: string;
  plan_medico: string;
  datos_especialidad?: Record<string, unknown> | null;
  diagnosticos: DiagnosticoCreate[];
}

export interface ConsultaResponse {
  id_consulta: number;
  id_clinica: number;
  id_historia: number;
  id_cita: number;
  id_medico: number;
  motivo_consulta: string;
  sintomas: string;
  examen_fisico?: string | null;
  observaciones?: string | null;
  evolucion: string;
  plan_medico: string;
  signos_vitales?: SignosVitales | null;
  datos_especialidad?: Record<string, unknown> | null;
  fecha_consulta: string;
  diagnosticos: DiagnosticoResponse[];
}

export interface HistoriaClinicaBaseResponse {
  id_historia: number;
  id_clinica: number;
  id_paciente: number;
  numero_historia: string;
  antecedentes_personales?: string | null;
  antecedentes_familiares?: string | null;
  alergias?: string | null;
  habitos?: string | null;
  observaciones?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface HistoriaClinicaCompletaResponse extends HistoriaClinicaBaseResponse {
  consultas: ConsultaResponse[];
}

export interface Cie10Item {
  codigo: string;
  descripcion: string;
  categoria: string;
}
