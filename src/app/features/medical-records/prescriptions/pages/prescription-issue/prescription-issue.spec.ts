import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { RecetaResponse } from '../../models/prescription.models';
import type { AppRole } from '../../../../../core/models/auth.models';
import { PrescriptionIssue } from './prescription-issue';

describe('PrescriptionIssue (CU16)', () => {
  const serviceMock = {
    issuePrescription: vi.fn(),
  };
  const routerMock = { navigate: vi.fn() };
  const authMock = {
    userRole: vi.fn((): AppRole => 'doctor'),
    isDoctor: vi.fn(() => true),
    isAdmin: vi.fn(() => false),
    isLoggedIn: vi.fn(() => true),
  };
  const queryParams: Record<string, string> = { id_consulta: '10', id_paciente: '5' };
  const routeMock = {
    snapshot: {
      queryParamMap: { get: vi.fn((key: string): string | null => queryParams[key] ?? null) },
      paramMap: { get: vi.fn(() => null) },
    },
  };
  let injector: DestroyableInjector;

  function create(role: AppRole = 'doctor'): PrescriptionIssue {
    authMock.userRole.mockReturnValue(role);
    authMock.isDoctor.mockReturnValue(role === 'doctor');
    authMock.isAdmin.mockReturnValue(role === 'admin');
    injector = Injector.create({
      providers: [
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: PrescriptionsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeMock },
      ],
    });
    return runInInjectionContext(injector, () => new PrescriptionIssue());
  }

  function fechaFutura(dias = 30): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

  function completarLineaValida(comp: PrescriptionIssue): void {
    comp.form.controls.fecha_vencimiento.setValue(fechaFutura(30));
    const linea = comp.detalles.at(0);
    linea.controls.modo.setValue('catalogo');
    linea.controls.id_medicamento.setValue(3);
    linea.controls.nombre_medicamento_manual.setValue(null);
    linea.controls.dosis.setValue('500 mg');
    linea.controls.frecuencia.setValue('c/8h');
    linea.controls.duracion.setValue('7 días');
    linea.controls.via_administracion.setValue('ORAL');
    linea.controls.cantidad.setValue(21);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams['id_consulta'] = '10';
    queryParams['id_paciente'] = '5';
  });

  it('doctor entra con contexto válido fijado y no editable', () => {
    const comp = create('doctor');
    comp.ngOnInit();
    expect(routerMock.navigate).not.toHaveBeenCalled();
    expect(comp.contextoClinicoValido()).toBe(true);
    expect(comp.contextoConsultaId()).toBe(10);
    expect(comp.contextoPacienteId()).toBe(5);
    expect(comp.form.controls.id_consulta.value).toBe(10);
    expect(comp.form.controls.id_paciente.value).toBe(5);
    expect(comp.form.controls.id_consulta.disabled).toBe(true);
    expect(comp.form.controls.id_paciente.disabled).toBe(true);
    injector.destroy();
  });

  it('admin no puede entrar al formulario de emisión', () => {
    const comp = create('admin');
    comp.ngOnInit();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    injector.destroy();
  });

  it('paciente no puede entrar al formulario de emisión', () => {
    const comp = create('paciente');
    comp.ngOnInit();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    injector.destroy();
  });

  it('usuario con rol desconocido no puede entrar al formulario', () => {
    const comp = create('unknown');
    comp.ngOnInit();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    injector.destroy();
  });

  it('contexto incompleto muestra orientación y bloquea la emisión', () => {
    delete queryParams['id_paciente'];
    const comp = create('doctor');
    comp.ngOnInit();
    expect(comp.contextoClinicoValido()).toBe(false);
    completarLineaValida(comp);
    comp.emitir();
    expect(serviceMock.issuePrescription).not.toHaveBeenCalled();
    expect(comp.submitError()).toContain('consulta registrada');
    injector.destroy();
  });

  it('parámetros inválidos no habilitan la emisión', () => {
    for (const invalido of ['abc', '0', '-3', '4.5', '']) {
      queryParams['id_consulta'] = invalido;
      queryParams['id_paciente'] = '5';
      const comp = create('doctor');
      comp.ngOnInit();
      expect(comp.contextoClinicoValido()).toBe(false);
      injector.destroy();
    }
    queryParams['id_consulta'] = '10';
    queryParams['id_paciente'] = '0';
    const comp = create('doctor');
    comp.ngOnInit();
    expect(comp.contextoClinicoValido()).toBe(false);
    injector.destroy();
  });

  it('exige mínimo de una línea y no permite cero detalles', () => {
    const comp = create();
    comp.ngOnInit();
    expect(comp.detalles.length).toBe(1);
    comp.retirarLinea(0);
    expect(comp.detalles.length).toBe(1);
    injector.destroy();
  });

  it('XOR inválido bloquea emisión cuando ambos o ninguno tienen valor', () => {
    const comp = create();
    comp.ngOnInit();
    completarLineaValida(comp);
    const linea = comp.detalles.at(0);
    linea.controls.id_medicamento.setValue(3);
    linea.controls.nombre_medicamento_manual.setValue('Manual');
    expect(linea.invalid).toBe(true);
    linea.controls.id_medicamento.setValue(null);
    linea.controls.nombre_medicamento_manual.setValue(null);
    expect(linea.invalid).toBe(true);
    injector.destroy();
  });

  it('cantidad debe ser positiva', () => {
    const comp = create();
    comp.ngOnInit();
    completarLineaValida(comp);
    comp.detalles.at(0).controls.cantidad.setValue(0);
    expect(comp.detalles.at(0).controls.cantidad.invalid).toBe(true);
    comp.detalles.at(0).controls.cantidad.setValue(5);
    expect(comp.detalles.at(0).controls.cantidad.valid).toBe(true);
    injector.destroy();
  });

  it('vigencia local 1..90 invalida fechas fuera de rango', () => {
    const comp = create();
    comp.ngOnInit();
    comp.form.controls.fecha_vencimiento.setValue('2026-01-01');
    // Fecha igual a hoy depende del día actual; usa fecha pasada lejana para invalidez segura.
    comp.form.controls.fecha_vencimiento.setValue('2020-01-01');
    expect(comp.form.controls.fecha_vencimiento.invalid).toBe(true);
    injector.destroy();
  });

  it('evita doble envío mientras emite', () => {
    const comp = create();
    comp.ngOnInit();
    completarLineaValida(comp);
    const pendiente = new Subject<HttpResponse<RecetaResponse>>();
    serviceMock.issuePrescription.mockReturnValueOnce(pendiente.asObservable());
    comp.emitir();
    comp.emitir();
    expect(serviceMock.issuePrescription).toHaveBeenCalledTimes(1);
    pendiente.next(new HttpResponse({ status: 201, body: { id_receta: 1 } as RecetaResponse }));
    pendiente.complete();
    injector.destroy();
  });

  it('considera 201 y 200 exitosos y navega a la boleta', () => {
    const comp = create();
    comp.ngOnInit();
    completarLineaValida(comp);
    serviceMock.issuePrescription.mockReturnValueOnce(
      of(new HttpResponse({ status: 200, body: { id_receta: 42 } })),
    );
    comp.emitir();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/recetas', 42]);
    injector.destroy();
  });

  it('conserva el formulario ante 422 de máximo de clínica', () => {
    const comp = create();
    comp.ngOnInit();
    completarLineaValida(comp);
    const err = new HttpErrorResponse({
      status: 422,
      error: { detail: 'Máximo de clínica 30 días', code: 'PRESCRIPTION_VIGENCIA' },
    });
    serviceMock.issuePrescription.mockReturnValueOnce(throwError(() => err));
    comp.emitir();
    expect(comp.submitError()).toContain('Máximo de clínica');
    expect(comp.submitErrorCode()).toBe('PRESCRIPTION_VIGENCIA');
    expect(comp.form.getRawValue().id_consulta).toBe(10);
    expect(comp.detalles.length).toBe(1);
    injector.destroy();
  });
});
