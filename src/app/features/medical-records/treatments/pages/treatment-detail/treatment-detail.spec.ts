import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { TreatmentDetail } from './treatment-detail';
import { TreatmentsService } from '../../services/treatments.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { EstadoPlan, Plan } from '../../models/treatment.models';
import type { AppRole } from '../../../../../core/models/auth.models';

function mockPlan(
  id: number = 15,
  estado: EstadoPlan = 'ACTIVO',
  motivoCierre: string | null = null
): Plan {
  return {
    id_tratamiento: id,
    id_clinica: 1,
    id_consulta: 101,
    id_receta: 202,
    id_diagnostico: 303,
    diagnostico: {
      codigo_cie: 'I10',
      descripcion: 'Hipertensión esencial (primaria)',
    },
    id_paciente: 45,
    id_medico: 12,
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-11-30',
    zona_horaria: 'America/La_Paz',
    estado,
    notas: 'Tomar medicamentos después de los alimentos. Control de PA semanal.',
    motivo_cierre: motivoCierre,
    medicamentos: [
      {
        id_medicamento_plan: 1,
        id_receta_detalle: 11,
        medicamento_nombre: 'Losartán 50mg',
        dosis: '1 comprimido',
        via_administracion: 'ORAL',
        frecuencia_texto_receta: 'Cada 12 horas',
        duracion_texto_receta: '30 días',
        indicaciones: 'Vía oral con agua',
        fecha_inicio: '2026-11-01',
        fecha_fin: '2026-11-30',
        horas_locales: ['08:00', '20:00'],
        intervalo_horas: 12,
        estado: 'ACTIVO',
      },
      {
        id_medicamento_plan: 2,
        id_receta_detalle: 12,
        medicamento_nombre: 'Amlodipino 5mg',
        dosis: '1 tableta',
        via_administracion: 'ORAL',
        frecuencia_texto_receta: 'Cada 24 horas',
        duracion_texto_receta: '30 días',
        indicaciones: 'En las mañanas',
        fecha_inicio: '2026-11-01',
        fecha_fin: '2026-11-30',
        horas_locales: ['08:00'],
        intervalo_horas: 24,
        estado: 'SUSPENDIDO',
      },
    ],
    created_at: '2026-11-01T08:00:00Z',
    updated_at: '2026-11-01T08:00:00Z',
    adherencia: {
      numerador_puntual: 24,
      denominador_programado: 30,
      porcentaje: 80.0,
      nivel: 'OPTIMA',
      calculado_en: '2026-11-15T12:00:00Z',
    },
  };
}

describe('TreatmentDetail (CU17)', () => {
  const serviceMock = {
    getPlan: vi.fn(),
    registrarEvolucion: vi.fn(),
    actualizarVigencia: vi.fn(),
    finalizarPlan: vi.fn(),
    suspenderMedicamento: vi.fn(),
    reactivarMedicamento: vi.fn(),
  };

  const routerMock = {
    navigate: vi.fn(),
    url: '/tratamientos/15',
  };

  let authMock: {
    userRole: ReturnType<typeof vi.fn>;
    isDoctor: ReturnType<typeof vi.fn>;
    isPaciente: ReturnType<typeof vi.fn>;
    isLoggedIn: ReturnType<typeof vi.fn>;
  };

  let routeMock: {
    snapshot: {
      paramMap: {
        get: ReturnType<typeof vi.fn>;
      };
    };
  };

  let injector: DestroyableInjector;

  function createComponent(role: AppRole, idParam: string | null = '15'): TreatmentDetail {
    authMock = {
      userRole: vi.fn(() => role),
      isDoctor: vi.fn(() => role === 'doctor'),
      isPaciente: vi.fn(() => role === 'paciente'),
      isLoggedIn: vi.fn(() => true),
    };

    routeMock = {
      snapshot: {
        paramMap: {
          get: vi.fn((key: string) => (key === 'id' ? idParam : null)),
        },
      },
    };

    injector = Injector.create({
      providers: [
        { provide: TreatmentsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeMock },
      ],
    });

    return runInInjectionContext(injector, () => new TreatmentDetail());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getPlan.mockReturnValue(of(mockPlan()));
    serviceMock.registrarEvolucion.mockReturnValue(of({ id_evento: 50 }));
    serviceMock.actualizarVigencia.mockReturnValue(of(mockPlan(15, 'ACTIVO')));
    serviceMock.finalizarPlan.mockReturnValue(of(mockPlan(15, 'FINALIZADO', 'Alta médica')));
    serviceMock.suspenderMedicamento.mockReturnValue(of(mockPlan()));
    serviceMock.reactivarMedicamento.mockReturnValue(of(mockPlan()));
  });

  afterEach(() => {
    if (injector) {
      injector.destroy();
    }
  });

  it('1. Carga del plan: obtiene id_tratamiento desde ActivatedRoute y consulta TreatmentsService.getPlan', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    expect(serviceMock.getPlan).toHaveBeenCalledWith(15);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    expect(comp.plan()?.id_tratamiento).toBe(15);
    expect(comp.plan()?.diagnostico?.codigo_cie).toBe('I10');
    expect(comp.plan()?.diagnostico?.descripcion).toBe('Hipertensión esencial (primaria)');
  });

  it('2. Renderizado de medicamentos: lista los medicamentos con su pauta, dosis y estado', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    const plan = comp.plan();
    expect(plan?.medicamentos.length).toBe(2);

    const med1 = plan!.medicamentos[0];
    expect(med1.medicamento_nombre).toBe('Losartán 50mg');
    expect(med1.dosis).toBe('1 comprimido');
    expect(med1.horas_locales).toEqual(['08:00', '20:00']);
    expect(med1.intervalo_horas).toBe(12);
    expect(med1.estado).toBe('ACTIVO');

    const med2 = plan!.medicamentos[1];
    expect(med2.medicamento_nombre).toBe('Amlodipino 5mg');
    expect(med2.estado).toBe('SUSPENDIDO');

    // activeMedications computada solo debe contener medicamentos activos
    expect(comp.activeMedications().length).toBe(1);
    expect(comp.activeMedications()[0].id_medicamento_plan).toBe(1);
  });

  it('3. Widget de Adherencia y motivo de cierre', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    expect(comp.adherenciaPorcentaje()).toBe(80.0);
    expect(comp.adherenciaPorcentajeClamped()).toBe(80.0);
    expect(comp.getNivelAdherenciaLabel('OPTIMA')).toBe('Óptima');
    expect(comp.getNivelAdherenciaBadgeClasses('OPTIMA')).toContain('bg-emerald-50');
    expect(comp.getAdherenciaBarColor('OPTIMA')).toBe('bg-emerald-500');

    // Con motivo de cierre
    const planCerrado = mockPlan(15, 'FINALIZADO', 'Tratamiento completado con éxito.');
    serviceMock.getPlan.mockReturnValueOnce(of(planCerrado));
    comp.cargarPlan(15);
    expect(comp.plan()?.motivo_cierre).toBe('Tratamiento completado con éxito.');
    expect(comp.getEstadoLabel('FINALIZADO')).toBe('Finalizado');
  });

  it('4. Acciones médicas globales: canManagePlan visible solo si es doctor y plan está ACTIVO', () => {
    const doctorComp = createComponent('doctor', '15');
    doctorComp.ngOnInit();
    expect(doctorComp.isDoctor()).toBe(true);
    expect(doctorComp.isPlanActive()).toBe(true);
    expect(doctorComp.canManagePlan()).toBe(true);

    // Usuario paciente
    const pacienteComp = createComponent('paciente', '15');
    pacienteComp.ngOnInit();
    expect(pacienteComp.isDoctor()).toBe(false);
    expect(pacienteComp.canManagePlan()).toBe(false);

    // Doctor con plan finalizado
    serviceMock.getPlan.mockReturnValueOnce(of(mockPlan(15, 'FINALIZADO')));
    doctorComp.cargarPlan(15);
    expect(doctorComp.isPlanActive()).toBe(false);
    expect(doctorComp.canManagePlan()).toBe(false);
  });

  it('5. Suspender medicamento: abre modal, valida motivo (10 a 1000 cars) y llama a suspenderMedicamento', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    const med = comp.plan()!.medicamentos[0];
    comp.abrirModalSuspender(med);
    expect(comp.modalSuspenderMedOpen()).toBe(true);
    expect(comp.selectedMed()?.id_medicamento_plan).toBe(1);

    // Motivo corto
    comp.motivoMedicamento.set('Corto');
    comp.guardarSuspender();
    expect(comp.actionError()).toContain('entre 10 y 1000');
    expect(serviceMock.suspenderMedicamento).not.toHaveBeenCalled();

    // Motivo válido
    comp.motivoMedicamento.set('Reacción adversa gastrointestinal reportada.');
    comp.guardarSuspender();
    expect(serviceMock.suspenderMedicamento).toHaveBeenCalledWith(15, 1, {
      motivo: 'Reacción adversa gastrointestinal reportada.',
    });
    expect(comp.modalSuspenderMedOpen()).toBe(false);
    expect(comp.toastMessage()).toContain('suspendido');
  });

  it('6. Reactivar medicamento: abre modal, valida motivo y llama a reactivarMedicamento', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    const med = comp.plan()!.medicamentos[1];
    comp.abrirModalReactivar(med);
    expect(comp.modalReactivarMedOpen()).toBe(true);
    expect(comp.selectedMed()?.id_medicamento_plan).toBe(2);

    comp.motivoMedicamento.set('Reevaluación clínica favorable, reanudación de esquema.');
    comp.guardarReactivar();
    expect(serviceMock.reactivarMedicamento).toHaveBeenCalledWith(15, 2, {
      motivo: 'Reevaluación clínica favorable, reanudación de esquema.',
    });
    expect(comp.modalReactivarMedOpen()).toBe(false);
    expect(comp.toastMessage()).toContain('reactivado');
  });

  it('7. Registrar evolución: abre modal, valida nota (10 a 4000 caracteres) y llama a registrarEvolucion', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    comp.abrirModalEvolucion();
    expect(comp.modalEvolucionOpen()).toBe(true);

    // Nota muy corta
    comp.notaEvolucion.set('Breve');
    comp.guardarEvolucion();
    expect(comp.actionError()).toContain('entre 10 y 4000');
    expect(serviceMock.registrarEvolucion).not.toHaveBeenCalled();

    // Nota válida
    comp.notaEvolucion.set('Paciente refiere mejoría clínica notable, sin mareos ni cefalea.');
    comp.guardarEvolucion();
    expect(serviceMock.registrarEvolucion).toHaveBeenCalledWith(15, {
      nota: 'Paciente refiere mejoría clínica notable, sin mareos ni cefalea.',
    });
    expect(comp.modalEvolucionOpen()).toBe(false);
    expect(comp.toastMessage()).toContain('Evolución clínica registrada');
  });

  it('8. Prorrogar vigencia: valida nueva fecha_fin posterior a actual y llama a actualizarVigencia', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    comp.abrirModalVigencia();
    expect(comp.modalVigenciaOpen()).toBe(true);
    // Medicamentos activos seleccionados por defecto
    expect(comp.selectedMedsForVigencia()).toEqual([1]);

    // Toggle medicamento
    comp.toggleMedForVigencia(1);
    expect(comp.isMedSelectedForVigencia(1)).toBe(false);
    comp.toggleMedForVigencia(1);
    expect(comp.isMedSelectedForVigencia(1)).toBe(true);

    // Fecha fin inválida (anterior a la actual 2026-11-30)
    comp.nuevaFechaFin.set('2026-11-15');
    comp.motivoVigencia.set('Motivo suficientemente explicativo para la prueba.');
    comp.guardarVigencia();
    expect(comp.actionError()).toContain('estrictamente posterior');
    expect(serviceMock.actualizarVigencia).not.toHaveBeenCalled();

    // Fecha fin válida posterior
    comp.nuevaFechaFin.set('2026-12-15');
    comp.motivoVigencia.set('Ampliación de ciclo ambulatorio según protocolo.');
    comp.guardarVigencia();

    expect(serviceMock.actualizarVigencia).toHaveBeenCalledWith(15, {
      fecha_fin: '2026-12-15',
      motivo: 'Ampliación de ciclo ambulatorio según protocolo.',
      medicamentos: [{ id_medicamento_plan: 1, fecha_fin: '2026-12-15' }],
    });
    expect(comp.modalVigenciaOpen()).toBe(false);
    expect(comp.toastMessage()).toContain('prorrogada');
  });

  it('9. Finalizar tratamiento: abre modal para registrar motivo clínico de cierre y llama a finalizarPlan', () => {
    const comp = createComponent('doctor', '15');
    comp.ngOnInit();

    comp.abrirModalFinalizar();
    expect(comp.modalFinalizarOpen()).toBe(true);

    comp.motivoFinalizar.set('Objetivos terapéuticos cumplidos y estabilización tensional.');
    comp.guardarFinalizar();

    expect(serviceMock.finalizarPlan).toHaveBeenCalledWith(15, {
      motivo: 'Objetivos terapéuticos cumplidos y estabilización tensional.',
    });
    expect(comp.modalFinalizarOpen()).toBe(false);
    expect(comp.toastMessage()).toContain('finalizado con éxito');
  });

  it('10. Manejo de estados de carga, error y reintento', () => {
    // Parámetro ID inválido
    const invalidComp = createComponent('doctor', 'no-numerico');
    invalidComp.ngOnInit();
    expect(invalidComp.isLoading()).toBe(false);
    expect(invalidComp.errorMessage()).toBe('Identificador de tratamiento inválido.');
    expect(serviceMock.getPlan).not.toHaveBeenCalled();

    // Error HTTP 404
    serviceMock.getPlan.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404 }))
    );
    const errorComp = createComponent('doctor', '99');
    errorComp.ngOnInit();
    expect(errorComp.isLoading()).toBe(false);
    expect(errorComp.errorMessage()).toContain('Tratamiento no encontrado');

    // Reintento exitoso
    serviceMock.getPlan.mockReturnValueOnce(of(mockPlan(99)));
    errorComp.cargarPlan(99);
    expect(errorComp.isLoading()).toBe(false);
    expect(errorComp.errorMessage()).toBeNull();
    expect(errorComp.plan()?.id_tratamiento).toBe(99);
  });
});
