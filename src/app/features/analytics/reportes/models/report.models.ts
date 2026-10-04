/** Contract: openspec/contracts/analytics.md (CU22 / CU27-reportes). */
export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'html';
export type ReportCell = string | number | null;

export interface ReportMetric {
  disponible: boolean;
  valor: number | null;
  causa: string | null;
}

export interface CatalogReport {
  id: string;
  titulo: string;
  fuente: string;
  metrica_principal: string;
  metricas: string[];
  dimensiones: string[];
  columnas: string[];
  ordenables: string[];
  filtros: { campo: string; operadores: 'eq'[] }[];
  semantica: string;
}

export interface ReportCatalog {
  reportes: CatalogReport[];
  metricas_no_disponibles: Record<string, ReportMetric>;
  formatos: ReportFormat[];
  limites: {
    periodo_dias: number;
    filtros: number;
    agrupaciones: number;
    columnas: number;
    tamano_pagina: number;
    filas_exportacion: number;
  };
  modalidades: string[];
  categorias_nulas: Record<string, string>;
}

export interface ReportOptions {
  medicos: { id_medico: number; nombre: string }[];
  especialidades: { id_especialidad: number; nombre: string }[];
}

export interface ReportFilter {
  campo: string;
  operador: 'eq';
  valor: number | string;
}

export interface ReportSort {
  campo: string;
  direccion: 'asc' | 'desc';
}

export interface ReportQuery {
  reporte: string;
  periodo: { desde: string; hasta: string };
  filtros: ReportFilter[];
  columnas: string[];
  agrupacion: string[];
  orden: ReportSort[];
  pagina: number;
  tamano_pagina: number;
}

export interface ReportQueryResponse {
  definicion: ReportQuery;
  semantica: string;
  metricas: Record<string, ReportMetric>;
  total: number;
  filas: Record<string, ReportCell>[];
  advertencias: string[];
  generado_en: string;
}

export interface ReportInterpretRequest {
  texto: string;
  fecha_referencia: string;
}

export type ReportInterpretState = 'valida' | 'aclaracion' | 'no_admitida';
export type ReportClarificationField = 'reporte' | 'periodo' | 'id_medico' |
  'id_especialidad' | 'filtros' | 'agrupacion' | 'columnas' | 'orden';

export interface ReportInterpretResponse {
  estado: ReportInterpretState;
  definicion: ReportQuery | null;
  resumen: string;
  campos_aclaracion: ReportClarificationField[];
  advertencias: string[];
}

export interface ReportTranscriptionResponse {
  texto: string;
}

export interface ExportRequest extends ReportQuery {
  formato: ReportFormat;
}
