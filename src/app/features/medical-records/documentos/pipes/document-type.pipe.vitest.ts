import { describe, it, expect } from 'vitest';
import { DocumentTypePipe, DocumentIconPipe } from './document-type.pipe';

describe('DocumentTypePipe (CU12)', () => {
  const pipe = new DocumentTypePipe();

  it('traduce tipo a etiqueta', () => {
    expect(pipe.transform('RECETA')).toBe('Receta');
    expect(pipe.transform('ORDEN_LAB')).toBe('Orden de Laboratorio');
    expect(pipe.transform('RESULTADO_LAB')).toBe('Resultado de Laboratorio');
    expect(pipe.transform('CERTIFICADO')).toBe('Certificado Médico');
    expect(pipe.transform('INDICACION')).toBe('Indicación Médica');
  });

  it('deja valor no mapeado tal cual', () => {
    expect(pipe.transform('OTRO_TIPO')).toBe('OTRO_TIPO');
    expect(pipe.transform(undefined as unknown as string)).toBe('');
  });
});

describe('DocumentIconPipe (CU12)', () => {
  const pipe = new DocumentIconPipe();

  it('mapea tipo a icono', () => {
    expect(pipe.transform('RECETA')).toBe('medication');
    expect(pipe.transform('ORDEN_LAB')).toBe('science');
    expect(pipe.transform('RESULTADO_LAB')).toBe('lab_profile');
    expect(pipe.transform('CERTIFICADO')).toBe('assignment');
    expect(pipe.transform('INDICACION')).toBe('healing');
  });

  it('usa icono por defecto para tipos desconocidos', () => {
    expect(pipe.transform('OTRO')).toBe('description');
  });
});