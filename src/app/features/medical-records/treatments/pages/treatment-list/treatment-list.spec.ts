import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { TreatmentsService } from '../../services/treatments.service';
import { TreatmentList } from './treatment-list';
import {
  EstadoPlan,
  Plan,
  PlanListResponse,
  PlanQueryParams,
} from '../../models/treatment.models';
import type { AppRole } from '../../../../../core/models/auth.models';

function mockPlan(
  id: number,
  estado: EstadoPlan = 'ACTIVO',
  porcentaje: number | null = 85,
  nivel: 'OPTIMA' | 'REGULAR' | 'CRITICA' | 'SIN_DATOS' = 'OPTIMA'
): Plan {
  return {
    id_tratamiento: id,
    id_clinica: 1,
    id_consulta: 10,
    id_receta: 100,
    id_diagnostico: 5,
    diagnostico: {
      codigo_cie: 'J00',
      descripcion: 'Rinofaringitis aguda',
    },
    id_paciente: 42,
    id_medico: 7,
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-11-10',
    zona_horaria: 'America/La_Paz',
    estado,
    notas: 'Tomar con abundante agua',
    motivo_cierre: null,
    medicamentos: [
      {
        id_medicamento_plan: 1,
        id_receta_detalle: 1,
        medicamento_nombre: 'Paracetamol',
        dosis: '500mg',
        via_administracion: 'Oral',
        frecuencia_texto_receta: 'Cada 8 horas',
        duracion_texto_receta: '5 días',
        indicaciones: null,
        fecha_inicio: '2026-11-01',
        fecha_fin: '2026-11-06',
        horas_locales: ['08:00', '16:00', '00:00'],
        intervalo_horas: 8,
        estado: 'ACTIVO',
      },
    ],
    created_at: '2026-11-01T08:00:00Z',
    updated_at: '2026-11-01T08:00:00Z',
    adherencia: {
      numerador_puntual: 8,
      denominador_programado: 10,
      porcentaje,
      nivel,
      calculado_en: '2026-11-05T12:00:00Z',
    },
  };
}

describe('TreatmentList (CU17)', () => {
  const serviceMock = {
    listPlans: vi.fn((_params: PlanQueryParams = {}) =>
      of({ items: [] as Plan[], total: 0 } as PlanListResponse)
    ),
  };
  const routerMock = { navigate: vi.fn() };
  let authMock: {
    userRole: ReturnType<typeof vi.fn>;
    isDoctor: ReturnType<typeof vi.fn>;
    isPaciente: ReturnType<typeof vi.fn>;
  };
  let injector: DestroyableInjector;

  function createComponent(role: AppRole): TreatmentList {
    authMock = {
      userRole: vi.fn(() => role),
      isDoctor: vi.fn(() => role === 'doctor'),
      isPaciente: vi.fn(() => role === 'paciente'),
    };

    injector = Injector.create({
      providers: [
        { provide: TreatmentsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    return runInInjectionContext(injector, () => new TreatmentList());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.listPlans.mockReturnValue(of({ items: [] as Plan[], total: 0 }));
  });

  it('carga inicial lista de tratamientos y actualiza señales reactivas', () => {
    serviceMock.listPlans.mockReturnValueOnce(
      of({ items: [mockPlan(1)], total: 1 })
    );

    const comp = createComponent('doctor');
    comp.ngOnInit();

    expect(serviceMock.listPlans).toHaveBeenCalled();
    expect(comp.planes().length).toBe(1);
    expect(comp.total()).toBe(1);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('muestra estado vacío sin error cuando no hay planes registrados', () => {
    const comp = createComponent('paciente');
    comp.ngOnInit();

    expect(comp.planes()).toEqual([]);
    expect(comp.total()).toBe(0);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('captura y muestra mensaje de error recuperable ante fallo del backend', () => {
    const backendError = new HttpErrorResponse({
      status: 403,
      error: { detail: 'Acceso no autorizado a tratamientos' },
    });
    serviceMock.listPlans.mockReturnValueOnce(throwError(() => backendError));

    const comp = createComponent('paciente');
    comp.loadPlans(1);

    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBe('Acceso no autorizado a tratamientos');
    injector.destroy();
  });

  describe('Adaptación por rol (Médico vs Paciente)', () => {
    it('médico puede emitir plan y navegar a /tratamientos/crear', () => {
      const comp = createComponent('doctor');
      expect(comp.isDoctor()).toBe(true);
      expect(comp.isPaciente()).toBe(false);
      expect(comp.canEmit()).toBe(true);

      comp.goToCreate();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/tratamientos/crear']);
      injector.destroy();
    });

    it('paciente no puede emitir plan', () => {
      const comp = createComponent('paciente');
      expect(comp.isDoctor()).toBe(false);
      expect(comp.isPaciente()).toBe(true);
      expect(comp.canEmit()).toBe(false);
      injector.destroy();
    });

    it('médico puede filtrar por paciente ID numérico', () => {
      const comp = createComponent('doctor');
      comp.idPacienteFiltro.set('42');
      comp.loadPlans(1);

      const calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      expect(calls[0][0].id_paciente).toBe(42);
      injector.destroy();
    });

    it('paciente no envía filtro id_paciente al backend para evitar violación de alcance', () => {
      const comp = createComponent('paciente');
      comp.idPacienteFiltro.set('42');
      comp.loadPlans(1);

      const calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      expect(calls[0][0].id_paciente).toBeUndefined();
      injector.destroy();
    });
  });

  describe('Filtros y Paginación', () => {
    it('filtra por estado y resetea a la primera página', () => {
      const comp = createComponent('doctor');
      comp.estadoFiltro.set('ACTIVO');
      comp.onSearch();

      const calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      expect(calls[0][0].estado).toBe('ACTIVO');
      expect(comp.page()).toBe(1);
      injector.destroy();
    });

    it('limpia filtros y recarga la lista', () => {
      const comp = createComponent('doctor');
      comp.estadoFiltro.set('FINALIZADO');
      comp.idPacienteFiltro.set('10');

      comp.clearFilters();

      expect(comp.estadoFiltro()).toBe('');
      expect(comp.idPacienteFiltro()).toBe('');
      const calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.estado).toBeUndefined();
      expect(lastCall.id_paciente).toBeUndefined();
      injector.destroy();
    });

    it('calcula skip y limit correctamente al avanzar y retroceder de página', () => {
      serviceMock.listPlans.mockReturnValue(
        of({ items: [] as Plan[], total: 25 } as PlanListResponse)
      );
      const comp = createComponent('doctor');
      comp.limit.set(5);
      comp.total.set(25);

      comp.loadPlans(2);
      let calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      let lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.skip).toBe(5);
      expect(lastArgs.limit).toBe(5);
      expect(comp.page()).toBe(2);

      comp.nextPage();
      calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.skip).toBe(10);
      expect(comp.page()).toBe(3);

      comp.prevPage();
      calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.skip).toBe(5);
      expect(comp.page()).toBe(2);

      injector.destroy();
    });

    it('cambia el límite por página y recarga desde la página 1', () => {
      const comp = createComponent('doctor');
      comp.onLimitChange(20);

      expect(comp.limit()).toBe(20);
      expect(comp.page()).toBe(1);
      const calls = serviceMock.listPlans.mock.calls as unknown as Array<[PlanQueryParams]>;
      const lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.limit).toBe(20);
      expect(lastArgs.skip).toBe(0);
      injector.destroy();
    });
  });

  describe('Formateo de Badges y Diagnóstico', () => {
    it('genera clases e insignias correctas según el estado del plan', () => {
      const comp = createComponent('doctor');

      const activo = comp.getEstadoBadge('ACTIVO');
      expect(activo.label).toBe('Activo');
      expect(activo.class).toContain('emerald');

      const finalizado = comp.getEstadoBadge('FINALIZADO');
      expect(finalizado.label).toBe('Finalizado');
      expect(finalizado.class).toContain('slate');

      const suspendido = comp.getEstadoBadge('SUSPENDIDO_POR_RECETA');
      expect(suspendido.label).toBe('Suspendido por receta');
      expect(suspendido.class).toContain('rose');

      injector.destroy();
    });

    it('genera insignias y estilos correctos según nivel de adherencia', () => {
      const comp = createComponent('paciente');

      const optima = comp.getAdherenciaBadge('OPTIMA');
      expect(optima.label).toBe('Óptima');
      expect(optima.class).toContain('emerald');

      const regular = comp.getAdherenciaBadge('REGULAR');
      expect(regular.label).toBe('Regular');
      expect(regular.class).toContain('amber');

      const critica = comp.getAdherenciaBadge('CRITICA');
      expect(critica.label).toBe('Crítica');
      expect(critica.class).toContain('rose');

      const sinDatos = comp.getAdherenciaBadge('SIN_DATOS');
      expect(sinDatos.label).toBe('Sin datos');
      expect(sinDatos.class).toContain('gray');

      injector.destroy();
    });

    it('formatea el texto de diagnóstico CIE adecuadamente', () => {
      const comp = createComponent('doctor');
      const planConCie = mockPlan(1);
      expect(comp.getDiagnosticoTexto(planConCie)).toBe('J00 - Rinofaringitis aguda');

      const planSinCie = mockPlan(2);
      planSinCie.diagnostico = null;
      expect(comp.getDiagnosticoTexto(planSinCie)).toBe('Sin diagnóstico CIE asociado');

      injector.destroy();
    });
  });
});
