import { ReportCatalog, ReportOptions, ReportQuery, ReportQueryResponse } from '../models/report.models';

export const catalogFixture: ReportCatalog = {
  reportes: [
    {
      id: 'encuentros', titulo: 'Encuentros con consulta registrada', fuente: 'consultas',
      metrica_principal: 'encuentros', metricas: ['encuentros', 'pacientes_unicos'],
      dimensiones: ['fecha', 'id_medico', 'id_especialidad', 'modalidad'],
      columnas: ['fecha', 'id_medico', 'id_especialidad', 'modalidad', 'encuentros', 'pacientes_unicos'],
      ordenables: ['fecha', 'id_medico', 'id_especialidad', 'modalidad', 'encuentros', 'pacientes_unicos'],
      filtros: ['id_medico', 'id_especialidad', 'modalidad'].map((campo) => ({ campo, operadores: ['eq' as const] })),
      semantica: 'Citas distintas con consulta registrada.',
    },
    {
      id: 'citas', titulo: 'Actividad de citas', fuente: 'citas',
      metrica_principal: 'citas', metricas: ['citas', 'cancelaciones'],
      dimensiones: ['fecha', 'id_medico', 'id_especialidad', 'estado', 'modalidad'],
      columnas: ['fecha', 'id_medico', 'id_especialidad', 'estado', 'modalidad', 'citas', 'cancelaciones'],
      ordenables: ['fecha', 'id_medico', 'id_especialidad', 'estado', 'modalidad', 'citas', 'cancelaciones'],
      filtros: ['id_medico', 'id_especialidad', 'estado', 'modalidad'].map((campo) => ({ campo, operadores: ['eq' as const] })),
      semantica: 'Citas distintas por fecha programada.',
    },
  ],
  metricas_no_disponibles: {
    ausentismo: { disponible: false, valor: null, causa: 'SIN_ESTADO_AUSENCIA' },
  },
  formatos: ['pdf', 'xlsx', 'csv', 'html'],
  limites: { periodo_dias: 366, filtros: 8, agrupaciones: 2, columnas: 6, tamano_pagina: 100, filas_exportacion: 5000 },
  modalidades: ['PRESENCIAL', 'TELEMEDICINA', 'CONFLICTO', 'DESCONOCIDA', 'OTRA'],
  categorias_nulas: { id_especialidad: 'Sin especialidad registrada' },
};

export const optionsFixture: ReportOptions = {
  medicos: [{ id_medico: 7, nombre: 'Médico de prueba' }],
  especialidades: [{ id_especialidad: 2, nombre: 'Especialidad de prueba' }],
};

export const queryFixture: ReportQuery = {
  reporte: 'encuentros',
  periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
  filtros: [{ campo: 'id_medico', operador: 'eq', valor: 7 }],
  columnas: ['fecha', 'encuentros', 'pacientes_unicos'],
  agrupacion: ['fecha'],
  orden: [{ campo: 'fecha', direccion: 'asc' }],
  pagina: 1,
  tamano_pagina: 20,
};

export function responseFixture(definicion: ReportQuery = queryFixture): ReportQueryResponse {
  return {
    definicion,
    semantica: 'Pacientes únicos globales, sin sumar los grupos.',
    metricas: {
      encuentros: { disponible: true, valor: 3, causa: null },
      pacientes_unicos: { disponible: true, valor: 2, causa: null },
      ausentismo: { disponible: false, valor: null, causa: 'SIN_ESTADO_AUSENCIA' },
    },
    total: 2,
    filas: [
      { fecha: '2026-09-01', encuentros: 2, pacientes_unicos: 2 },
      { fecha: '2026-09-02', encuentros: 1, pacientes_unicos: 1 },
    ],
    advertencias: ['SIN_ESTADO_AUSENCIA'],
    generado_en: '2026-10-01T12:00:00Z',
  };
}
