import { HttpErrorResponse } from '@angular/common/http';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { MedicineProducts } from './medicine-products';

describe('MedicineProducts CU16', () => {
  const medicine = {
    id_medicamento: 7,
    nombre: 'Paracetamol',
    principio_activo: 'Paracetamol',
    concentracion: '500 mg',
    forma_farmaceutica: 'Comprimido',
    descripcion: null,
    estado: 'ACTIVO' as const,
  };
  const serviceMock = { searchMedicines: vi.fn(), createMedicine: vi.fn() };
  let injector: DestroyableInjector;

  function create(): MedicineProducts {
    injector = Injector.create({
      providers: [FormBuilder, { provide: PrescriptionsService, useValue: serviceMock }],
    });
    return runInInjectionContext(injector, () => new MedicineProducts());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.searchMedicines.mockReturnValue(of({ items: [medicine], total: 1 }));
    serviceMock.createMedicine.mockReturnValue(of(medicine));
  });

  it('carga el catalogo activo', () => {
    const component = create();
    component.ngOnInit();
    expect(serviceMock.searchMedicines).toHaveBeenCalledWith({
      query: '',
      estado: 'ACTIVO',
      limit: 200,
    });
    expect(component.medicines()).toEqual([medicine]);
    injector.destroy();
  });

  it('registra un producto, limpia el formulario y recarga', () => {
    const component = create();
    component.createForm.patchValue({ nombre: ' Paracetamol ', concentracion: ' 500 mg ' });
    component.createMedicine();
    expect(serviceMock.createMedicine).toHaveBeenCalledWith({
      nombre: 'Paracetamol',
      principio_activo: null,
      concentracion: '500 mg',
      forma_farmaceutica: null,
      descripcion: null,
    });
    expect(component.createSuccess()).toContain('Paracetamol');
    expect(serviceMock.searchMedicines).toHaveBeenCalled();
    injector.destroy();
  });

  it('muestra el detalle del backend cuando el alta falla', () => {
    serviceMock.createMedicine.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'El medicamento ya existe en el catálogo' },
          }),
      ),
    );
    const component = create();
    component.createForm.patchValue({ nombre: 'Paracetamol' });
    component.createMedicine();
    expect(component.createError()).toBe('El medicamento ya existe en el catálogo');
    injector.destroy();
  });
});
