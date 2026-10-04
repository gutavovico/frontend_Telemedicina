import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, signal, type DestroyableInjector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { HceService } from '../../../../core/services/hce.service';
import { PatientService } from '../../../../core/services/patient.service';
import { AuthService } from '../../../../core/services/auth.service';
import type { ConsultaResponse } from '../../../../core/models/hce.models';
import { HceTimeline } from './hce-timeline';

function consultaBase(idConsulta: number): ConsultaResponse {
  return {
    id_consulta: idConsulta,
    id_clinica: 1,
    id_historia: 1,
    id_cita: 1,
    id_medico: 3,
    motivo_consulta: 'Control',
    sintomas: 'Síntomas registrados',
    evolucion: 'Evolución registrada',
    plan_medico: 'Plan registrado',
    fecha_consulta: '2026-01-01',
    diagnosticos: [],
  };
}

describe('HceTimeline acción Emitir receta (CU16 hallazgo 4)', () => {
  const routerMock = { navigate: vi.fn() };
  const routeMock = { snapshot: { paramMap: { get: vi.fn(() => '7') } } };
  const hceServiceMock = {
    historiaActual: signal(null),
    isLoading: signal(false),
    errorMessage: signal(null),
    getHistoriaClinica: vi.fn(() => of(null)),
  };
  const patientServiceMock = {
    selectedPatient: signal(null),
    getPatientById: vi.fn(() => of(null)),
  };
  const authMock = { isDoctor: vi.fn(() => true) };
  let injector: DestroyableInjector;

  function create(): HceTimeline {
    injector = Injector.create({
      providers: [
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: Router, useValue: routerMock },
        { provide: HceService, useValue: hceServiceMock },
        { provide: PatientService, useValue: patientServiceMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
    return runInInjectionContext(injector, () => new HceTimeline());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isDoctor.mockReturnValue(true);
  });

  it('médico navega a emitir con IDs del recurso cargado', () => {
    const comp = create();
    comp.ngOnInit();
    expect(comp.idPaciente()).toBe(7);
    const consulta = consultaBase(45);
    expect(comp.puedeEmitirReceta(consulta)).toBe(true);
    comp.emitirReceta(consulta);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/recetas/emitir'], {
      queryParams: { id_consulta: 45, id_paciente: 7 },
    });
    injector.destroy();
  });

  it('no médico no ve ni ejecuta la acción', () => {
    authMock.isDoctor.mockReturnValue(false);
    const comp = create();
    comp.ngOnInit();
    expect(comp.puedeEmitirReceta(consultaBase(45))).toBe(false);
    comp.emitirReceta(consultaBase(45));
    expect(routerMock.navigate).not.toHaveBeenCalled();
    injector.destroy();
  });

  it('no aparece si falta consulta o paciente válido', () => {
    const comp = create();
    comp.ngOnInit();
    expect(comp.puedeEmitirReceta(consultaBase(0))).toBe(false);
    comp.idPaciente.set(0);
    expect(comp.puedeEmitirReceta(consultaBase(45))).toBe(false);
    comp.emitirReceta(consultaBase(45));
    expect(routerMock.navigate).not.toHaveBeenCalled();
    injector.destroy();
  });
});
