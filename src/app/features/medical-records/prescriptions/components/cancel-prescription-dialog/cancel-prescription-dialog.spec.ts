import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { CancelPrescriptionDialog } from './cancel-prescription-dialog';
import { RecetaResponse } from '../../models/prescription.models';

describe('CancelPrescriptionDialog (CU16)', () => {
  const serviceMock = { cancelPrescription: vi.fn() };
  let injector: DestroyableInjector;

  function create(): CancelPrescriptionDialog {
    injector = Injector.create({
      providers: [
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: PrescriptionsService, useValue: serviceMock },
      ],
    });
    return runInInjectionContext(injector, () => new CancelPrescriptionDialog());
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('motivo obligatorio de 15 a 500 caracteres', () => {
    const comp = create();
    comp.recetaId = 1;
    comp.form.controls.motivo_anulacion.setValue('corto');
    expect(comp.form.controls.motivo_anulacion.invalid).toBe(true);
    comp.form.controls.motivo_anulacion.setValue('Motivo clínico suficientemente largo');
    expect(comp.form.controls.motivo_anulacion.valid).toBe(true);
    injector.destroy();
  });

  it('maneja 409 conservando la entrada no sensible', () => {
    const comp = create();
    comp.recetaId = 4;
    comp.form.controls.motivo_anulacion.setValue('Motivo clínico suficientemente largo');
    const err = new HttpErrorResponse({
      status: 409,
      error: { detail: 'Ya anulada', code: 'PRESCRIPTION_CONFLICT' },
    });
    serviceMock.cancelPrescription.mockReturnValueOnce(throwError(() => err));
    comp.confirmar();
    expect(comp.errorMessage()).toBe('Ya anulada');
    expect(comp.errorCode()).toBe('PRESCRIPTION_CONFLICT');
    expect(comp.form.controls.motivo_anulacion.value).toBe('Motivo clínico suficientemente largo');
    injector.destroy();
  });

  it('maneja 403, 404 y 422 con detail accionable', () => {
    const comp = create();
    comp.recetaId = 4;
    comp.form.controls.motivo_anulacion.setValue('Motivo clínico suficientemente largo');
    for (const status of [403, 404, 422]) {
      const err = new HttpErrorResponse({
        status,
        error: { detail: `Error ${status}`, code: `CODE_${status}` },
      });
      serviceMock.cancelPrescription.mockReturnValueOnce(throwError(() => err));
      comp.confirmar();
      expect(comp.errorMessage()).toBe(`Error ${status}`);
    }
    injector.destroy();
  });

  it('al confirmar emite la receta actualizada', () => {
    const comp = create();
    comp.recetaId = 4;
    comp.form.controls.motivo_anulacion.setValue('Motivo clínico suficientemente largo');
    const actualizada = { id_receta: 4, estado: 'ANULADA' } as RecetaResponse;
    serviceMock.cancelPrescription.mockReturnValueOnce(of(actualizada));
    const emitidos: RecetaResponse[] = [];
    comp.cancelled.subscribe((r: RecetaResponse) => emitidos.push(r));
    comp.confirmar();
    expect(emitidos).toEqual([actualizada]);
    injector.destroy();
  });
});
