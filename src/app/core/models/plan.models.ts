export type Recurso = 'MEDICOS' | 'SEDES' | 'CONSULTAS';
export type Unidad = 'MEDICO_CICLO_MENSUAL' | 'SEDE_CICLO_MENSUAL' | 'CONSULTA';
export interface Tarifa {
  recurso: Recurso;
  unidad: Unidad;
  precio: string;
}
export interface CondicionesPlan {
  nombre: string;
  descripcion: string | null;
  precio_mensual: string;
  moneda: 'BOB';
  ciclo: 'MENSUAL';
  servicios_incluidos: string[];
  limite_medicos: number | null;
  limite_sedes: number | null;
  limite_consultas: number | null;
  tarifas_excedentes: Tarifa[];
  demora_pago_dias: number;
}
export interface VersionPlan extends CondicionesPlan {
  id: number;
  plan_id: number;
  numero: number;
  creado_por: number;
  creado_en: string;
}
export interface Plan {
  id: number;
  codigo: string;
  activo: boolean;
  version_actual: number;
  creado_en: string;
  actualizado_en: string;
  version: VersionPlan;
}
export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}
export interface OpcionesPlanes {
  moneda: 'BOB';
  ciclo: 'MENSUAL';
  servicios: { codigo: string; nombre: string }[];
  recursos: { recurso: Recurso; unidad: Unidad; nombre: string }[];
}
export interface PlanCreate extends CondicionesPlan {
  codigo: string;
}
export interface VersionCreate extends CondicionesPlan {
  version_base: number;
}
