import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { MedicineCatalogDialog } from './medicine-catalog-dialog';
import type { AppRole } from '../../../../../core/models/auth.models';

describe('MedicineCatalogDialog (CU16)', () => {
  const serviceMock = {
    searchMedicines: vi.fn(() => of({ items: [], total: 0 })),
    createMedicine: vi.fn(),
  };
  let authMock: { userRole: ReturnType<typeof vi.fn>; isAdmin: ReturnType<typeof vi.fn> };
  let injector: DestroyableInjector;

  function create(role: AppRole): MedicineCatalogDialog {
    authMock = {
      userRole: vi.fn(() => role),
      isAdmin: vi.fn(() => role === 'admin'),
    };
    injector = Injector.create({
      providers: [
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: PrescriptionsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
    return runInInjectionContext(injector, () => new MedicineCatalogDialog());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.searchMedicines.mockReturnValue(of({ items: [], total: 0 }));
  });

  it('búsqueda disponible para médico y admin, creación solo para ADMIN', () => {
    const medico = create('doctor');
    expect(medico.canSearch).toBe(true);
    expect(medico.canCreate).toBe(false);
    injector.destroy();
    const admin = create('admin');
    expect(admin.canSearch).toBe(true);
    expect(admin.canCreate).toBe(true);
    injector.destroy();
    const paciente = create('paciente');
    expect(paciente.canSearch).toBe(false);
    expect(paciente.canCreate).toBe(false);
    injector.destroy();
    const desconocido = create('unknown');
    expect(desconocido.canSearch).toBe(false);
    expect(desconocido.canCreate).toBe(false);
    injector.destroy();
  });

  it('maneja duplicado 409 sin incorporar edición o eliminación', () => {
    const comp = create('admin');
    comp.createForm.controls.nombre.setValue('Amoxicilina');
    const err = new HttpErrorResponse({
      status: 409,
      error: { detail: 'Ya existe', code: 'MEDICINE_DUPLICATE' },
    });
    serviceMock.createMedicine.mockReturnValueOnce(throwError(() => err));
    comp.crear();
    expect(comp.createError()).toContain('Duplicado');
    injector.destroy();
  });
});
