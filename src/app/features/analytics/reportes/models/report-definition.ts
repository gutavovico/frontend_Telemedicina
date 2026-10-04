import { CatalogReport, ReportCatalog, ReportFilter, ReportQuery, ReportSort } from './report.models';

export interface ReportDraft {
  reporte: string;
  desde: string;
  hasta: string;
  id_medico: string;
  id_especialidad: string;
  estado: string;
  modalidad: string;
  tamano_pagina: number;
}

export interface DefinitionResult {
  definition: ReportQuery | null;
  error: string | null;
}

export const APPOINTMENT_STATES = [
  'PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'FINALIZADA', 'CANCELADA',
] as const;

export function sameReportConfiguration(a: ReportQuery, b: ReportQuery): boolean {
  const sameList = (left: string[], right: string[]) =>
    left.length === right.length && left.every((field, index) => field === right[index]);
  return a.reporte === b.reporte && a.periodo.desde === b.periodo.desde &&
    a.periodo.hasta === b.periodo.hasta && a.tamano_pagina === b.tamano_pagina &&
    sameList(a.columnas, b.columnas) && sameList(a.agrupacion, b.agrupacion) &&
    a.orden.length === b.orden.length && a.orden.every((sort, index) =>
      sort.campo === b.orden[index].campo && sort.direccion === b.orden[index].direccion) &&
    a.filtros.length === b.filtros.length && a.filtros.every((filter) =>
      b.filtros.some((other) => other.campo === filter.campo &&
        other.operador === filter.operador && other.valor === filter.valor));
}

export function reportFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    fecha: 'Fecha',
    id_medico: 'Médico ID',
    id_especialidad: 'Especialidad ID',
    estado: 'Estado',
    modalidad: 'Modalidad registrada',
    encuentros: 'Encuentros',
    citas: 'Citas',
    cancelaciones: 'Cancelaciones',
    pacientes_unicos: 'Pacientes únicos',
  };
  return labels[field] ?? field;
}

function validDate(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
    ? timestamp : null;
}

export function buildReportDefinition(
  catalog: ReportCatalog,
  report: CatalogReport | undefined,
  draft: ReportDraft,
  columns: string[],
  groups: string[],
  sorts: ReportSort[],
): DefinitionResult {
  if (!report || report.id !== draft.reporte || !catalog.reportes.some((item) => item.id === report.id)) {
    return { definition: null, error: 'Selecciona un tipo de reporte disponible.' };
  }
  const from = validDate(draft.desde);
  const to = validDate(draft.hasta);
  if (from === null || to === null || from > to) {
    return { definition: null, error: 'Selecciona un período válido con fecha inicial anterior a la final.' };
  }
  const days = Math.floor((to - from) / 86_400_000) + 1;
  if (days > catalog.limites.periodo_dias) {
    return { definition: null, error: `El período no puede superar ${catalog.limites.periodo_dias} días.` };
  }
  if (!Number.isInteger(draft.tamano_pagina) || draft.tamano_pagina < 1 ||
      draft.tamano_pagina > catalog.limites.tamano_pagina) {
    return { definition: null, error: 'El tamaño de página no está permitido.' };
  }
  if (groups.length > catalog.limites.agrupaciones || new Set(groups).size !== groups.length ||
      groups.some((field) => !report.dimensiones.includes(field))) {
    return { definition: null, error: 'La agrupación no es compatible con este reporte.' };
  }
  if (columns.length === 0 || columns.length > catalog.limites.columnas ||
      new Set(columns).size !== columns.length || !columns.includes(report.metrica_principal) ||
      columns.some((field) => !report.columnas.includes(field)) ||
      groups.some((field) => !columns.includes(field)) ||
      columns.some((field) => report.dimensiones.includes(field) && !groups.includes(field))) {
    return { definition: null, error: 'Selecciona columnas compatibles e incluye la métrica principal y las agrupaciones.' };
  }
  if (sorts.length > catalog.limites.columnas ||
      new Set(sorts.map((item) => item.campo)).size !== sorts.length ||
      sorts.some((item) => !report.ordenables.includes(item.campo) ||
        !columns.includes(item.campo) ||
        (report.dimensiones.includes(item.campo) && !groups.includes(item.campo)) ||
        !['asc', 'desc'].includes(item.direccion))) {
    return { definition: null, error: 'El orden debe usar columnas seleccionadas sin repetir campos.' };
  }

  const filters: ReportFilter[] = [];
  const allowed = new Set(report.filtros.filter((filter) => filter.operadores.includes('eq'))
    .map((filter) => filter.campo));
  for (const field of ['id_medico', 'id_especialidad', 'estado', 'modalidad'] as const) {
    const value = draft[field];
    if (value === '') continue;
    if (!allowed.has(field)) {
      return { definition: null, error: `El filtro ${reportFieldLabel(field)} no corresponde al reporte.` };
    }
    if (field === 'id_medico' || field === 'id_especialidad') {
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return { definition: null, error: `Selecciona un ${reportFieldLabel(field).toLowerCase()} válido.` };
      }
      filters.push({ campo: field, operador: 'eq', valor: parsed });
    } else if (field === 'estado') {
      if (!APPOINTMENT_STATES.some((state) => state === value)) {
        return { definition: null, error: 'El estado no está permitido.' };
      }
      filters.push({ campo: field, operador: 'eq', valor: value });
    } else {
      if (!catalog.modalidades.includes(value)) {
        return { definition: null, error: 'La modalidad no está permitida.' };
      }
      filters.push({ campo: field, operador: 'eq', valor: value });
    }
  }
  if (filters.length > catalog.limites.filtros) {
    return { definition: null, error: 'Hay demasiados filtros para este reporte.' };
  }
  return {
    definition: {
      reporte: report.id,
      periodo: { desde: draft.desde, hasta: draft.hasta },
      filtros: filters,
      columnas: [...columns],
      agrupacion: [...groups],
      orden: sorts.map((sort) => ({ ...sort })),
      pagina: 1,
      tamano_pagina: draft.tamano_pagina,
    },
    error: null,
  };
}
