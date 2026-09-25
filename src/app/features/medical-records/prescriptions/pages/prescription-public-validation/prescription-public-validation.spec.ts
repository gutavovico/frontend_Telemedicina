import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  type DestroyableInjector,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { PrescriptionPublicValidation } from './prescription-public-validation';

describe('PrescriptionPublicValidation (CU16)', () => {
  const serviceMock = { validatePublic: vi.fn() };
  let injector: DestroyableInjector;

  function create(codigoParam: string | null): PrescriptionPublicValidation {
    const routeMock = {
      snapshot: { paramMap: { get: vi.fn(() => codigoParam) } },
    };
    injector = Injector.create({
      providers: [
        { provide: PrescriptionsService, useValue: serviceMock },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    return runInInjectionContext(injector, () => new PrescriptionPublicValidation());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      injector.destroy();
    } catch {
      // Sin inyector activo.
    }
  });

  it('muestra vigente cuando el backend responde EMITIDA válida', () => {
    serviceMock.validatePublic.mockReturnValueOnce(
      of({
        valida: true,
        estado: 'EMITIDA',
        folio: 'REC-1',
        fecha_emision: '2026-01-01',
        fecha_vencimiento: '2026-02-01',
        esta_vencida: false,
        institucion: 'Hospital',
        medico_emisor: { nombre: 'Dra', matricula: 'M1', especialidad: null },
        paciente: { nombre: 'J***', documento_identidad: '***' },
        medicamentos_prescritos: [],
      }),
    );
    const comp = create('CODIGO1');
    comp.ngOnInit();
    expect(serviceMock.validatePublic).toHaveBeenCalledWith('CODIGO1');
    expect(comp.estadoVista()).toBe('emitida');
    expect(comp.detalleEncontrado()?.folio).toBe('REC-1');
    comp.ngOnDestroy();
  });

  it('respuesta uniforme no encontrada no revela detalles', () => {
    serviceMock.validatePublic.mockReturnValueOnce(of({ valida: false, estado: 'NO_ENCONTRADA' }));
    const comp = create('INEXISTENTE');
    comp.ngOnInit();
    expect(comp.estadoVista()).toBe('no-encontrada');
    expect(comp.detalleEncontrado()).toBeNull();
    comp.ngOnDestroy();
  });

  it('representa vencida y anulada desde el estado público', () => {
    serviceMock.validatePublic.mockReturnValueOnce(
      of({ valida: false, estado: 'VENCIDA', folio: 'R', institucion: 'H' }),
    );
    const compV = create('V');
    compV.ngOnInit();
    expect(compV.estadoVista()).toBe('vencida');
    compV.ngOnDestroy();
    injector.destroy();

    serviceMock.validatePublic.mockReturnValueOnce(
      of({ valida: false, estado: 'ANULADA', folio: 'R', institucion: 'H' }),
    );
    const compA = create('A');
    compA.ngOnInit();
    expect(compA.estadoVista()).toBe('anulada');
    compA.ngOnDestroy();
  });

  it('429 lee Retry-After, deshabilita reintento y cuenta regresivamente', () => {
    const err = new HttpErrorResponse({
      status: 429,
      statusText: 'Too Many Requests',
      error: { detail: 'Límite', code: 'PRESCRIPTION_RATE_LIMITED' },
      headers: new HttpHeaders({ 'Retry-After': '3' }),
    });
    serviceMock.validatePublic.mockReturnValueOnce(throwError(() => err));
    const comp = create('COD');
    comp.ngOnInit();
    expect(comp.estadoVista()).toBe('limitada');
    expect(comp.reintentoEn()).toBe(3);
    // Segundo intento bloqueado mientras hay cuenta regresiva.
    serviceMock.validatePublic.mockClear();
    comp.validar();
    expect(serviceMock.validatePublic).not.toHaveBeenCalled();
    comp.ngOnDestroy();
  });

  it('no persiste el código en almacenamiento del navegador', () => {
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem, removeItem: vi.fn(), clear: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem, setItem, removeItem: vi.fn(), clear: vi.fn() });
    try {
      serviceMock.validatePublic.mockReturnValueOnce(
        of({ valida: false, estado: 'NO_ENCONTRADA' }),
      );
      const comp = create('SECRETO');
      comp.ngOnInit();
      expect(setItem).not.toHaveBeenCalled();
      comp.ngOnDestroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
