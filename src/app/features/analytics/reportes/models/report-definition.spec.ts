import { describe, expect, it } from 'vitest';
import { buildReportDefinition, reportFieldLabel, sameReportConfiguration, type ReportDraft } from './report-definition';
import { catalogFixture, queryFixture } from '../testing/report-fixtures';

const draft: ReportDraft = {
  reporte: 'encuentros', desde: '2026-09-01', hasta: '2026-09-30',
  id_medico: '7', id_especialidad: '', estado: '', modalidad: 'TELEMEDICINA',
  tamano_pagina: 20,
};
const report = catalogFixture.reportes[0];

describe('CU22 definición de consulta', () => {
  it('identifica como ID las dimensiones numéricas devueltas por la API', () => {
    expect(reportFieldLabel('id_medico')).toBe('Médico ID');
    expect(reportFieldLabel('id_especialidad')).toBe('Especialidad ID');
  });
  it('construye filtros permitidos, columnas ordenadas y agrupación sin id_clinica', () => {
    const result = buildReportDefinition(catalogFixture, report, draft,
      ['fecha', 'encuentros', 'pacientes_unicos'], ['fecha'], [{ campo: 'fecha', direccion: 'desc' }]);
    expect(result.error).toBeNull();
    expect(result.definition).toEqual({
      reporte: 'encuentros', periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      filtros: [
        { campo: 'id_medico', operador: 'eq', valor: 7 },
        { campo: 'modalidad', operador: 'eq', valor: 'TELEMEDICINA' },
      ],
      columnas: ['fecha', 'encuentros', 'pacientes_unicos'], agrupacion: ['fecha'],
      orden: [{ campo: 'fecha', direccion: 'desc' }], pagina: 1, tamano_pagina: 20,
    });
    expect(result.definition).not.toHaveProperty('id_clinica');
  });

  it('rechaza fechas inválidas, invertidas y períodos sobre el límite', () => {
    for (const changes of [
      { desde: '2026-02-30' }, { desde: '2026-10-01' },
      { desde: '2025-08-01' },
    ]) {
      expect(buildReportDefinition(catalogFixture, report, { ...draft, ...changes },
        ['encuentros'], [], []).definition).toBeNull();
    }
  });

  it('rechaza dimensiones, columnas, orden y filtros incompatibles', () => {
    const cases = [
      { columns: ['encuentros'], groups: ['fecha'] },
      { columns: ['fecha', 'encuentros'], groups: [] },
      { columns: ['encuentros', 'encuentros'], groups: [] },
      { columns: ['encuentros'], groups: [], sorts: [{ campo: 'fecha', direccion: 'asc' as const }] },
    ];
    for (const item of cases) {
      expect(buildReportDefinition(catalogFixture, report, draft,
        item.columns, item.groups, item.sorts ?? []).definition).toBeNull();
    }
    expect(buildReportDefinition(catalogFixture, report,
      { ...draft, estado: 'CANCELADA' }, ['encuentros'], [], []).definition).toBeNull();
    expect(buildReportDefinition(catalogFixture, report,
      { ...draft, tamano_pagina: 101 }, ['encuentros'], [], []).definition).toBeNull();
  });

  it('mantiene vigente un resultado si solo cambia la página, pero detecta cambios de filtros u orden', () => {
    expect(sameReportConfiguration(queryFixture, { ...queryFixture, pagina: 2 })).toBe(true);
    expect(sameReportConfiguration(queryFixture, { ...queryFixture, filtros: [] })).toBe(false);
    expect(sameReportConfiguration(queryFixture, { ...queryFixture,
      orden: [{ campo: 'fecha', direccion: 'desc' }] })).toBe(false);
  });
});
