import { describe, it, expect } from 'vitest';
import {
  diasHastaVencimiento,
  esCantidadPositiva,
  esLineaXorValida,
  esVigenciaLocalValida,
  extraerNombrePdfDesdeContentDisposition,
  generarIdempotencyKey,
} from './prescription.models';

describe('prescription.models (CU16)', () => {
  it('XOR catálogo/manual acepta exactamente uno', () => {
    expect(esLineaXorValida({ id_medicamento: 3, nombre_medicamento_manual: null })).toBe(true);
    expect(esLineaXorValida({ id_medicamento: null, nombre_medicamento_manual: 'Ibu' })).toBe(true);
    expect(esLineaXorValida({ id_medicamento: 3, nombre_medicamento_manual: 'Ibu' })).toBe(false);
    expect(esLineaXorValida({ id_medicamento: null, nombre_medicamento_manual: '   ' })).toBe(
      false,
    );
    expect(esLineaXorValida({ id_medicamento: null, nombre_medicamento_manual: null })).toBe(false);
  });

  it('cantidad positiva exige entero mayor que cero', () => {
    expect(esCantidadPositiva(1)).toBe(true);
    expect(esCantidadPositiva(30)).toBe(true);
    expect(esCantidadPositiva(0)).toBe(false);
    expect(esCantidadPositiva(-2)).toBe(false);
    expect(esCantidadPositiva(1.5)).toBe(false);
  });

  it('vigencia local exige 1 a 90 días', () => {
    expect(esVigenciaLocalValida('2026-01-02', '2026-01-01')).toBe(true);
    expect(esVigenciaLocalValida('2026-01-01', '2026-01-01')).toBe(false);
    expect(esVigenciaLocalValida('2026-04-02', '2026-01-01')).toBe(false);
    expect(esVigenciaLocalValida('2025-12-31', '2026-01-01')).toBe(false);
    expect(diasHastaVencimiento('2026-01-11', '2026-01-01')).toBe(10);
  });

  it('genera claves de idempotencia únicas con formato UUID', () => {
    const a = generarIdempotencyKey();
    const b = generarIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(b.length).toBeGreaterThan(20);
  });

  it('extrae nombre seguro desde Content-Disposition', () => {
    expect(
      extraerNombrePdfDesdeContentDisposition(
        'attachment; filename="receta_REC-1.pdf"',
        'fallback.pdf',
      ),
    ).toBe('receta_REC-1.pdf');
    expect(extraerNombrePdfDesdeContentDisposition(null, 'fallback.pdf')).toBe('fallback.pdf');
    expect(extraerNombrePdfDesdeContentDisposition('inline', 'fallback.pdf')).toBe('fallback.pdf');
  });
});
