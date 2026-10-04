import { describe, it, expect } from 'vitest';
import { PrescriptionSheet } from './prescription-sheet';
import { RecetaResponse } from '../../models/prescription.models';

function baseReceta(overrides: Partial<RecetaResponse> = {}): RecetaResponse {
  return {
    id_receta: 1,
    id_clinica: 1,
    id_consulta: 10,
    id_paciente: 5,
    id_medico: 3,
    id_documento: 9,
    id_receta_sustituta: null,
    folio: 'REC-2026-000001',
    pdf_url: '/pdf/1',
    indicaciones_generales: 'Generales',
    algoritmo_firma: 'ED25519',
    key_id: 'key-1',
    version_payload: 1,
    hash_pdf: 'abcdef1234567890abcdef1234567890',
    fecha_emision: '2026-01-01',
    fecha_vencimiento: '2026-02-01',
    esta_vencida: false,
    estado: 'EMITIDA',
    motivo_anulacion: null,
    observaciones_anulacion: null,
    fecha_anulacion: null,
    medico: {
      id_medico: 3,
      nombre_completo: 'Dra. Test',
      matricula_profesional: 'MAT-1',
      especialidad: 'Clínica',
    },
    paciente: { id_paciente: 5, nombre_completo: 'Juan Pérez' },
    detalles: [
      {
        id_receta_detalle: 1,
        id_medicamento: 2,
        nombre_medicamento_manual: null,
        medicamento_nombre: 'Amoxicilina',
        principio_activo: 'Amoxicilina',
        concentracion: '500 mg',
        forma_farmaceutica: 'Cápsula',
        dosis: '500 mg',
        frecuencia: 'c/8h',
        duracion: '7 días',
        via_administracion: 'ORAL',
        cantidad: 21,
        indicaciones: 'Con alimentos',
        posicion: 2,
      },
      {
        id_receta_detalle: 2,
        id_medicamento: null,
        nombre_medicamento_manual: 'Jarabe natural',
        medicamento_nombre: 'Jarabe natural',
        principio_activo: null,
        concentracion: null,
        forma_farmaceutica: null,
        dosis: '10 ml',
        frecuencia: 'c/12h',
        duracion: '5 días',
        via_administracion: 'ORAL',
        cantidad: 1,
        indicaciones: null,
        posicion: 1,
      },
    ],
    ...overrides,
  } as RecetaResponse;
}

describe('PrescriptionSheet (CU16)', () => {
  it('ordena detalles por posición y muestra ordinal real', () => {
    const sheet = new PrescriptionSheet();
    sheet.receta = baseReceta();
    const ordenados = sheet.detallesOrdenados();
    expect(ordenados.map((d) => d.posicion)).toEqual([1, 2]);
    expect(ordenados[0].medicamento_nombre).toBe('Jarabe natural');
  });

  it('boleta emitida vigente usa estado EMITIDA sin vencida', () => {
    const sheet = new PrescriptionSheet();
    sheet.receta = baseReceta({ estado: 'EMITIDA', esta_vencida: false });
    expect(sheet.estadoTexto()).toBe('Vigente');
    expect(sheet.badgeClass()).toContain('emerald');
  });

  it('boleta vencida combina EMITIDA con esta_vencida', () => {
    const sheet = new PrescriptionSheet();
    sheet.receta = baseReceta({ estado: 'EMITIDA', esta_vencida: true });
    expect(sheet.estadoTexto()).toBe('Vencida');
    expect(sheet.badgeClass()).toContain('amber');
  });

  it('boleta anulada muestra rosa sobrio', () => {
    const sheet = new PrescriptionSheet();
    sheet.receta = baseReceta({
      estado: 'ANULADA',
      motivo_anulacion: 'Motivo clínico suficiente para anular',
    });
    expect(sheet.estadoTexto()).toBe('Anulada');
    expect(sheet.badgeClass()).toContain('rose');
  });

  it('abrevia hash con opción accesible de ver completo', () => {
    const sheet = new PrescriptionSheet();
    sheet.receta = baseReceta();
    const abreviado = sheet.hashAbreviado();
    expect(abreviado).toContain('…');
    expect(abreviado.length).toBeLessThan(sheet.receta?.hash_pdf.length ?? 0);
    expect(sheet.showFullHash()).toBe(false);
    sheet.alternarHash();
    expect(sheet.showFullHash()).toBe(true);
  });
});
