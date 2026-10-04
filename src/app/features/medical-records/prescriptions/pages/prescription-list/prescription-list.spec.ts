import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { PrescriptionList } from './prescription-list';
import { RecetaQueryParams, RecetaResponse } from '../../models/prescription.models';
import type { AppRole } from '../../../../../core/models/auth.models';

function recetaFolio(folio: string, estado: 'EMITIDA' | 'ANULADA' = 'EMITIDA'): RecetaResponse {
  return {
    id_receta: 1,
    id_clinica: 1,
    id_consulta: 1,
    id_paciente: 1,
    id_medico: 1,
    id_documento: 1,
    id_receta_sustituta: null,
    folio,
    pdf_url: '',
    indicaciones_generales: null,
    algoritmo_firma: 'ED25519',
    key_id: 'k',
    version_payload: 1,
    hash_pdf: 'h',
    fecha_emision: '2026-01-01',
    fecha_vencimiento: '2026-02-01',
    esta_vencida: false,
    estado,
    motivo_anulacion: null,
    observaciones_anulacion: null,
    fecha_anulacion: null,
    medico: { id_medico: 1, nombre_completo: 'M', matricula_profesional: 'X', especialidad: null },
    paciente: { id_paciente: 1, nombre_completo: 'P' },
    detalles: [],
  } as RecetaResponse;
}

describe('PrescriptionList (CU16)', () => {
  const serviceMock = {
    listPrescriptions: vi.fn((_params: RecetaQueryParams = {}) =>
      of({ items: [] as RecetaResponse[], total: 0 }),
    ),
  };
  const routerMock = { navigate: vi.fn() };
  let authMock: { userRole: ReturnType<typeof vi.fn>; isDoctor: ReturnType<typeof vi.fn> };
  let injector: DestroyableInjector;

  function create(role: AppRole): PrescriptionList {
    authMock = { userRole: vi.fn(() => role), isDoctor: vi.fn(() => role === 'doctor') };
    injector = Injector.create({
      providers: [
        { provide: PrescriptionsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
      ],
    });
    return runInInjectionContext(injector, () => new PrescriptionList());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.listPrescriptions.mockReturnValue(of({ items: [] as RecetaResponse[], total: 0 }));
  });

  it('carga inicial lista recetas y total', () => {
    serviceMock.listPrescriptions.mockReturnValueOnce(
      of({ items: [recetaFolio('REC-1')], total: 1 }),
    );
    const comp = create('doctor');
    comp.ngOnInit();
    expect(serviceMock.listPrescriptions).toHaveBeenCalled();
    expect(comp.recetas().length).toBe(1);
    expect(comp.total()).toBe(1);
    expect(comp.isLoading()).toBe(false);
    injector.destroy();
  });

  it('vacío muestra cero recetas sin error', () => {
    const comp = create('paciente');
    comp.ngOnInit();
    expect(comp.recetas()).toEqual([]);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('error recuperable muestra detail del backend', () => {
    const backendError = new HttpErrorResponse({
      status: 403,
      error: { detail: 'Sin permiso', code: 'FORBIDDEN' },
    });
    serviceMock.listPrescriptions.mockReturnValueOnce(throwError(() => backendError));
    const comp = create('doctor');
    comp.loadPrescriptions(1);
    expect(comp.errorMessage()).toBe('Sin permiso');
    injector.destroy();
  });

  it('estado textual y visual distingue vigente, vencida y anulada', () => {
    const comp = create('doctor');
    const vigente = recetaFolio('A');
    vigente.esta_vencida = false;
    const vencida = recetaFolio('B');
    vencida.esta_vencida = true;
    const anulada = recetaFolio('C', 'ANULADA');
    expect(comp.estadoTexto(vigente)).toBe('Vigente');
    expect(comp.estadoTexto(vencida)).toBe('Vencida');
    expect(comp.estadoTexto(anulada)).toBe('Anulada');
    expect(comp.badgeClass(vigente)).toContain('emerald');
    expect(comp.badgeClass(vencida)).toContain('amber');
    expect(comp.badgeClass(anulada)).toContain('rose');
    injector.destroy();
  });

  it('controles visibles por rol: emitir solo médico; admin no emite', () => {
    const doctor = create('doctor');
    expect(doctor.canIssue()).toBe(true);
    expect(doctor.isPaciente()).toBe(false);
    expect(doctor.isStaff()).toBe(true);
    injector.destroy();
    const admin = create('admin');
    expect(admin.canIssue()).toBe(false);
    expect(admin.isStaff()).toBe(true);
    injector.destroy();
    const paciente = create('paciente');
    expect(paciente.canIssue()).toBe(false);
    expect(paciente.isPaciente()).toBe(true);
    expect(paciente.isStaff()).toBe(false);
    injector.destroy();
    const desconocido = create('unknown');
    expect(desconocido.canIssue()).toBe(false);
    expect(desconocido.isStaff()).toBe(false);
    injector.destroy();
  });

  it('paciente y rol desconocido no envían filtros de alcance ajeno', () => {
    const paciente = create('paciente');
    paciente.idPacienteFiltro.set('9');
    paciente.idMedicoFiltro.set('4');
    paciente.loadPrescriptions(1);
    const calls = serviceMock.listPrescriptions.mock.calls as unknown as Array<[RecetaQueryParams]>;
    expect(calls[0][0].id_paciente).toBeUndefined();
    expect(calls[0][0].id_medico).toBeUndefined();
    injector.destroy();
  });

  it('paginación usa skip y limit', () => {
    const comp = create('doctor');
    comp.limit.set(10);
    comp.loadPrescriptions(3);
    const calls = serviceMock.listPrescriptions.mock.calls as unknown as Array<[RecetaQueryParams]>;
    const args = calls[0][0];
    expect(args.skip).toBe(20);
    expect(args.limit).toBe(10);
    expect(comp.page()).toBe(3);
    injector.destroy();
  });
});
