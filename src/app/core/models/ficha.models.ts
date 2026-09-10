export interface SignosVitales {
  presion_arterial?: string;
  frecuencia_cardiaca?: number;
  frecuencia_respiratoria?: number;
  temperatura?: number;
  saturacion_oxigeno?: number;
  peso_kg?: number;
  talla_cm?: number;
  imc?: number;
}

export interface SeccionesDinamicas {
  tipo_plantilla?: string;
  anamnesis?: string;
  examen_fisico?: string;
  antecedentes_relevantes?: string;
  [key: string]: any;
}

export interface FichaClinica {
  id_ficha: string;
  id_clinica: number;
  tenant_id?: number;
  correlativo: string;
  id_paciente: number;
  paciente_id?: number;
  paciente_nombre?: string;
  paciente_ci?: string;
  id_medico: number;
  medico_id?: number;
  medico_nombre?: string;
  id_servicio?: number;
  servicio_id?: number;
  servicio_nombre?: string;
  id_especialidad?: number;
  especialidad_id?: number;
  especialidad_nombre?: string;
  id_cita?: number;
  cita_id?: number;
  fecha_emision: string;
  fecha_atencion: string;
  hora_inicio: string;
  hora_fin: string;
  motivo_consulta: string;
  signos_vitales?: SignosVitales;
  secciones_dinamicas?: SeccionesDinamicas;
  codigo_cie10?: string;
  diagnostico_descripcion?: string;
  id_diagnostico?: number;
  notas_evolucion?: string;
  estado: 'EMITIDA' | 'EN_ATENCION' | 'FINALIZADA' | 'CANCELADA' | string;
  motivo_cancelacion?: string;
  created_at: string;
  updated_at: string;
}

export interface FichaCreateRequest {
  id_paciente: number;
  id_medico: number;
  id_servicio?: number;
  id_especialidad?: number;
  id_cita?: number;
  fecha_atencion: string;
  hora_inicio: string;
  hora_fin: string;
  motivo_consulta: string;
  signos_vitales?: SignosVitales;
  secciones_dinamicas?: SeccionesDinamicas;
}

export interface FichaClinicaUpdateRequest {
  signos_vitales?: SignosVitales;
  secciones_dinamicas?: SeccionesDinamicas;
  codigo_cie10?: string;
  diagnostico_descripcion?: string;
  id_diagnostico?: number;
  notas_evolucion?: string;
  estado?: string;
}

export interface FichaCancelRequest {
  motivo_cancelacion: string;
}

export interface FichaListResponse {
  total: number;
  items: FichaClinica[];
}
