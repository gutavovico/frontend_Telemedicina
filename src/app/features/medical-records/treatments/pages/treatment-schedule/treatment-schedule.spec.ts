import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { TreatmentsService } from '../../services/treatments.service';
import {
  CronogramaDia,
  Dosis,
  Plan,
  ConsultaIdempotenciaResponse,
} from '../../models/treatment.models';
import {
  TreatmentSchedule,
  getTodayDateString,
  PENDING_DOSE_TTL_MS,
  OperacionDosisPendiente,
  calcularRequestHash,
  serializarPayloadDosis,
} from './treatment-schedule';

function createMockCronograma(idTratamiento: number, fecha: string): CronogramaDia {
  return {
    id_tratamiento: idTratamiento,
    fecha,
    zona_horaria: 'America/La_Paz',
    dosis: [
      {
        id_dosis: 101,
        id_medicamento_plan: 1,
        programada_en: `${fecha}T08:00:00Z`,
        programada_hora_local: '08:00',
        zona_horaria: 'America/La_Paz',
        estado: 'PENDIENTE',
        vencida: false,
        efectiva_en: null,
        registrada_en: null,
        puntual: false,
        nota: null,
      },
      {
        id_dosis: 102,
        id_medicamento_plan: 1,
        programada_en: `${fecha}T16:00:00Z`,
        programada_hora_local: '16:00',
        zona_horaria: 'America/La_Paz',
        estado: 'INGERIDA',
        vencida: false,
        efectiva_en: `${fecha}T16:05:00-04:00`,
        registrada_en: `${fecha}T16:06:00Z`,
        puntual: true,
        nota: 'Tomada con alimentos',
      },
      {
        id_dosis: 103,
        id_medicamento_plan: 1,
        programada_en: `${fecha}T22:00:00Z`,
        programada_hora_local: '22:00',
        zona_horaria: 'America/La_Paz',
        estado: 'PENDIENTE',
        vencida: true,
        efectiva_en: null,
        registrada_en: null,
        puntual: false,
        nota: null,
      },
    ],
    adherencia: {
      numerador_puntual: 3,
      denominador_programado: 4,
      porcentaje: 75.0,
      nivel: 'REGULAR',
      calculado_en: '2026-10-30T12:00:00Z',
    },
  };
}

function formatLocalDateTime(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function createMockPlan(idTratamiento: number): Plan {
  return {
    id_tratamiento: idTratamiento,
    id_clinica: 1,
    id_consulta: 10,
    id_receta: 20,
    id_diagnostico: 5,
    diagnostico: {
      codigo_cie: 'J00',
      descripcion: 'Rinofaringitis aguda (resfriado común)',
    },
    id_paciente: 42,
    id_medico: 7,
    fecha_inicio: '2026-10-01',
    fecha_fin: '2026-11-01',
    zona_horaria: 'America/La_Paz',
    estado: 'ACTIVO',
    notas: 'Tomar abundante líquido',
    motivo_cierre: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    adherencia: {
      numerador_puntual: 3,
      denominador_programado: 4,
      porcentaje: 75.0,
      nivel: 'REGULAR',
      calculado_en: '2026-10-30T12:00:00Z',
    },
    medicamentos: [
      {
        id_medicamento_plan: 1,
        id_receta_detalle: 100,
        medicamento_nombre: 'Amoxicilina 500mg',
        dosis: '1 cápsula cada 8 horas',
        via_administracion: 'ORAL',
        frecuencia_texto_receta: 'Cada 8 horas',
        duracion_texto_receta: '7 días',
        indicaciones: 'Vía oral después de comer',
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-07',
        horas_locales: ['08:00', '16:00', '22:00'],
        intervalo_horas: 8,
        estado: 'ACTIVO',
      },
    ],
  };
}

describe('TreatmentSchedule (CU17)', () => {
  let treatmentsServiceMock: {
    getCronograma: ReturnType<typeof vi.fn>;
    getPlan: ReturnType<typeof vi.fn>;
    registrarDosis: ReturnType<typeof vi.fn>;
    consultarIdempotencia: ReturnType<typeof vi.fn>;
    iniciarIntento: ReturnType<typeof vi.fn>;
    resolverOperacionAbandonada: ReturnType<typeof vi.fn>;
  };
  let authServiceMock: {
    isPaciente: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let routeMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let injector: DestroyableInjector;

  function createComponent(isPaciente = true, idParam = '15', userId = 42, clinicId = 1): TreatmentSchedule {
    authServiceMock = {
      isPaciente: vi.fn(() => isPaciente),
      currentUser: vi.fn(() => ({ id_usuario: userId, id_clinica: clinicId, rol: isPaciente ? 'PACIENTE' : 'MEDICO' } as any)),
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
        { provide: TreatmentsService, useValue: treatmentsServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    return runInInjectionContext(injector, () => new TreatmentSchedule());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) sessionStorage.clear();
      if (window.localStorage) localStorage.clear();
    }
    treatmentsServiceMock = {
      getCronograma: vi.fn((id: number, fecha: string) => of(createMockCronograma(id, fecha))),
      getPlan: vi.fn((id: number) => of(createMockPlan(id))),
      registrarDosis: vi.fn((_idDosis, _payload, _key) =>
        of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis),
      ),
      consultarIdempotencia: vi.fn((_idDosis, _key) =>
        of({ confirmado: true, id_dosis: _idDosis, idempotency_key: _key, dosis: { id_dosis: _idDosis, estado: 'INGERIDA' } as any }),
      ),
      iniciarIntento: vi.fn((_idDosis, _hash, _key) =>
        of({
          id_dosis: _idDosis,
          idempotency_key: _key,
          estado: 'EN_CURSO',
          confirmado: false,
          en_curso: true,
          rechazado: false,
          dosis: null,
        } as ConsultaIdempotenciaResponse),
      ),
      resolverOperacionAbandonada: vi.fn((_idDosis, _key) =>
        of({
          id_dosis: _idDosis,
          idempotency_key: _key,
          estado: 'RECHAZADA',
          confirmado: false,
          en_curso: false,
          rechazado: true,
          dosis: null,
        } as ConsultaIdempotenciaResponse),
      ),
    };
    routerMock = { navigate: vi.fn() };
  });

  afterEach(() => {
    if (injector) {
      try {
        injector.destroy();
      } catch {}
      injector = null as any;
    }
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) sessionStorage.clear();
      if (window.localStorage) localStorage.clear();
    }
  });

  it('1. carga inicial obtiene id de ActivatedRoute, plan y cronograma para la fecha de hoy', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();

    expect(comp.idTratamiento()).toBe(15);
    expect(treatmentsServiceMock.getPlan).toHaveBeenCalledWith(15);
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalledWith(15, getTodayDateString());

    expect(comp.plan()?.diagnostico?.codigo_cie).toBe('J00');
    expect(comp.cronograma()?.dosis.length).toBe(3);
    expect(comp.adherenciaPorcentajeTexto()).toBe('75.0%');
    expect(comp.adherenciaFraccionTexto()).toBe('3 / 4 tomas puntuales');
    expect(comp.adherenciaBadgeClass()).toBe('bg-amber-50 text-amber-700 border-amber-200');
  });

  it('2. cambio de fecha: Día siguiente incrementa 1 día y recarga cronograma', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    comp.fechaSeleccionada.set('2026-10-15');
    vi.clearAllMocks();

    comp.cambiarDia(1);

    expect(comp.fechaSeleccionada()).toBe('2026-10-16');
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalledWith(15, '2026-10-16');
  });

  it('3. cambio de fecha: Día anterior decrementa 1 día y recarga cronograma', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    comp.fechaSeleccionada.set('2026-10-15');
    vi.clearAllMocks();

    comp.cambiarDia(-1);

    expect(comp.fechaSeleccionada()).toBe('2026-10-14');
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalledWith(15, '2026-10-14');
  });

  it('4. botón Hoy restablece la fecha al día actual', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    comp.fechaSeleccionada.set('2026-01-01');
    vi.clearAllMocks();

    comp.irAHoy();

    expect(comp.fechaSeleccionada()).toBe(getTodayDateString());
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalledWith(15, getTodayDateString());
  });

  it('5. cambio de fecha mediante datepicker onFechaChange recarga con nueva fecha', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    vi.clearAllMocks();

    comp.onFechaChange('2026-11-20');

    expect(comp.fechaSeleccionada()).toBe('2026-11-20');
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalledWith(15, '2026-11-20');
  });

  it('6. muestra badges de nivel de adherencia según el valor recibido', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();

    // REGULAR
    expect(comp.adherenciaBadgeClass()).toBe('bg-amber-50 text-amber-700 border-amber-200');

    // OPTIMA
    comp.cronograma.set({
      ...createMockCronograma(15, '2026-10-30'),
      adherencia: {
        numerador_puntual: 9,
        denominador_programado: 10,
        porcentaje: 90.0,
        nivel: 'OPTIMA',
        calculado_en: '2026-10-30T12:00:00Z',
      },
    });
    expect(comp.adherenciaBadgeClass()).toBe('bg-emerald-50 text-emerald-700 border-emerald-200');
    expect(comp.adherenciaPorcentajeTexto()).toBe('90.0%');

    // CRITICA
    comp.cronograma.set({
      ...createMockCronograma(15, '2026-10-30'),
      adherencia: {
        numerador_puntual: 1,
        denominador_programado: 10,
        porcentaje: 10.0,
        nivel: 'CRITICA',
        calculado_en: '2026-10-30T12:00:00Z',
      },
    });
    expect(comp.adherenciaBadgeClass()).toBe('bg-rose-50 text-rose-700 border-rose-200');

    // SIN_DATOS
    comp.cronograma.set({
      ...createMockCronograma(15, '2026-10-30'),
      adherencia: {
        numerador_puntual: 0,
        denominador_programado: 0,
        porcentaje: null,
        nivel: 'SIN_DATOS',
        calculado_en: '2026-10-30T12:00:00Z',
      },
    });
    expect(comp.adherenciaBadgeClass()).toBe('bg-slate-50 text-slate-700 border-slate-200');
    expect(comp.adherenciaPorcentajeTexto()).toBe('Sin datos');
  });

  it('7. modal de registro: abre modal y solo permite acceso a paciente titular', () => {
    // Caso 1: Paciente titular
    const compPaciente = createComponent(true, '15');
    compPaciente.ngOnInit();
    const dosisPendiente = compPaciente.cronograma()!.dosis[0];

    compPaciente.abrirModalRegistro(dosisPendiente);
    expect(compPaciente.isModalOpen()).toBe(true);
    expect(compPaciente.selectedDosis()?.id_dosis).toBe(101);
    expect(compPaciente.modalEstado()).toBe('INGERIDA');
    expect(compPaciente.modalHoraEfectiva()).toBeTruthy();

    compPaciente.cerrarModal();
    expect(compPaciente.isModalOpen()).toBe(false);
    expect(compPaciente.selectedDosis()).toBeNull();

    // Caso 2: Médico o staff (no es titular paciente)
    const compMedico = createComponent(false, '15');
    compMedico.ngOnInit();
    compMedico.abrirModalRegistro(dosisPendiente);
    expect(compMedico.isModalOpen()).toBe(false);
  });

  it('8. guardar registro de toma exitoso envía Idempotency-Key y refresca cronograma', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalEstado.set('INGERIDA');
    // Hora en el pasado (hace 10 minutos) en formato local
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 10 * 60 * 1000)));
    comp.modalNota.set('Tomada a tiempo con jugo');

    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const [idDosis, payload, key] = treatmentsServiceMock.registrarDosis.mock.calls[0];

    expect(idDosis).toBe(101);
    expect(payload.estado).toBe('INGERIDA');
    expect(payload.efectiva_en).toBeTruthy();
    expect(payload.nota).toBe('Tomada a tiempo con jugo');
    expect(key).toBeTruthy();
    expect(typeof key).toBe('string');

    // Verifica que tras éxito se cerró el modal y se mostró toast
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('9. validación en UI impide omitir una toma futura antes de su hora programada', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();

    // Dosis en el futuro
    const dosisFutura: Dosis = {
      id_dosis: 200,
      id_medicamento_plan: 1,
      programada_en: '2099-01-01T12:00:00Z',
      programada_hora_local: '12:00',
      zona_horaria: 'America/La_Paz',
      estado: 'PENDIENTE',
      vencida: false,
      efectiva_en: null,
      registrada_en: null,
      puntual: false,
      nota: null,
    };

    comp.abrirModalRegistro(dosisFutura);
    comp.modalEstado.set('OMITIDA');

    comp.guardarRegistro();

    expect(comp.modalError()).toBe('No se puede omitir una toma futura antes de su hora programada.');
    expect(treatmentsServiceMock.registrarDosis).not.toHaveBeenCalled();
  });

  it('10. manejo de error amigable cuando registrarDosis falla en backend', () => {
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { detail: 'La fecha y hora efectiva no puede preceder al inicio del plan' },
      }))
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 10 * 60 * 1000)));
    comp.guardarRegistro();

    expect(comp.modalError()).toBe('La fecha y hora efectiva no puede preceder al inicio del plan');
    expect(comp.isModalOpen()).toBe(true);
    expect(comp.isSaving()).toBe(false);
  });

  it('11. error en carga de cronograma muestra mensaje de error recuperable', () => {
    treatmentsServiceMock.getCronograma.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 404,
        error: { detail: 'Plan de tratamiento no encontrado' },
      }))
    );

    const comp = createComponent(true, '999');
    comp.ngOnInit();

    expect(comp.errorMessage()).toBe('Plan de tratamiento no encontrado');
    expect(comp.isLoading()).toBe(false);
  });

  it('12. conserva la misma Idempotency-Key al reintentar el registro de dosis tras un error de red o backend', () => {
    // Simulamos que el primer intento falla
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { detail: 'Error temporal de red o servidor' },
      }))
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));

    // Primer intento: falla
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const keyPrimerIntento = treatmentsServiceMock.registrarDosis.mock.calls[0][2];
    expect(keyPrimerIntento).toBeTruthy();
    expect(comp.modalError()).toContain('Error temporal de red o servidor');
    expect(comp.isModalOpen()).toBe(true);

    // Segundo intento (reintento del usuario sobre el modal abierto): tiene éxito
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    const keySegundoIntento = treatmentsServiceMock.registrarDosis.mock.calls[1][2];

    // LA CLAVE DEBE SER EXACTAMENTE LA MISMA para garantizar idempotencia en reintento
    expect(keySegundoIntento).toBe(keyPrimerIntento);
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('13. genera una nueva Idempotency-Key distinta al registrar una dosis diferente o tras cerrar y volver a abrir el modal', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis1 = comp.cronograma()!.dosis[0];
    const dosis2 = comp.cronograma()!.dosis[1];

    // Abrir y registrar dosis 1
    comp.abrirModalRegistro(dosis1);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 10 * 60 * 1000)));
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const keyDosis1 = treatmentsServiceMock.registrarDosis.mock.calls[0][2];
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.currentIdempotencyKey()).toBeNull();

    // Abrir modal para dosis 2 (operación nueva)
    comp.abrirModalRegistro(dosis2);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    const keyDosis2 = treatmentsServiceMock.registrarDosis.mock.calls[1][2];

    // Deben ser claves distintas
    expect(keyDosis2).toBeTruthy();
    expect(keyDosis2).not.toBe(keyDosis1);

    // Cerrar modal y reabrir para la misma dosis genera una nueva clave
    comp.abrirModalRegistro(dosis1);
    const keyApertura1 = comp.currentIdempotencyKey();
    comp.cerrarModal();
    expect(comp.currentIdempotencyKey()).toBeNull();

    comp.abrirModalRegistro(dosis1);
    const keyApertura2 = comp.currentIdempotencyKey();
    expect(keyApertura2).toBeTruthy();
    expect(keyApertura2).not.toBe(keyApertura1);
  });

  it('14. un error de red seguido de reintento conserva clave y cuerpo idénticos', () => {
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
        error: new ProgressEvent('error'),
      }))
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    const hora = formatLocalDateTime(new Date(Date.now() - 15 * 60 * 1000));
    comp.modalHoraEfectiva.set(hora);
    comp.modalNota.set('Toma con desayuno');

    // 1er intento: falla con error de red (status 0)
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const [id1, payload1, key1] = treatmentsServiceMock.registrarDosis.mock.calls[0];
    expect(id1).toBe(101);
    expect(payload1.estado).toBe('INGERIDA');
    expect(payload1.nota).toBe('Toma con desayuno');
    expect(comp.isModalOpen()).toBe(true);
    expect(comp.pendingOperation()).toBeTruthy();
    expect(comp.haModificadoDatosPendientes()).toBe(false);

    // 2do intento: el usuario pulsa Reintentar sin cambiar datos
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    const [id2, payload2, key2] = treatmentsServiceMock.registrarDosis.mock.calls[1];

    // Clave y payload deben ser EXACTAMENTE IDÉNTICOS
    expect(key2).toBe(key1);
    expect(payload2).toEqual(payload1);
    expect(id2).toBe(id1);

    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('15. si el usuario intenta editar datos tras un resultado incierto, no se envía la misma clave con otro cuerpo', () => {
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 500,
        error: { detail: 'Error interno en el servidor' },
      }))
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 20 * 60 * 1000)));
    comp.modalNota.set('Nota inicial');

    // Intento 1: falla 500
    comp.guardarRegistro();
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    expect(comp.pendingOperation()).toBeTruthy();

    // El usuario edita la nota tras el fallo
    comp.modalNota.set('Nota modificada por el paciente');
    expect(comp.haModificadoDatosPendientes()).toBe(true);

    // Intenta enviar con nota distinta
    comp.guardarRegistro();

    // NO debe llamar al servicio: ni con la misma clave ni con clave nueva silenciosa
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    expect(comp.modalError()).toContain('Has modificado los datos');

    // El usuario ahora cambia el estado a POSPUESTA
    comp.modalEstado.set('POSPUESTA');
    expect(comp.haModificadoDatosPendientes()).toBe(true);
    comp.guardarRegistro();
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);

    // El usuario pulsa "Restaurar datos originales"
    comp.restaurarDatosOriginales();
    expect(comp.modalEstado()).toBe('INGERIDA');
    expect(comp.modalNota()).toBe('Nota inicial');
    expect(comp.haModificadoDatosPendientes()).toBe(false);

    // Ahora sí puede reintentar con éxito
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    expect(comp.isModalOpen()).toBe(false);
  });

  it('16. el servidor confirma el primer intento, pero el cliente pierde la respuesta; la recuperación mediante reenvío idempotente obtiene el resultado de esa operación concreta y limpia el almacenamiento', () => {
    // Simulamos que el registro falló en el cliente por timeout / red caída (respuesta perdida)
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 0,
        error: new ProgressEvent('timeout'),
      }))
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));
    comp.modalNota.set('Toma confirmada');
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const [id1, payload1, key1] = treatmentsServiceMock.registrarDosis.mock.calls[0];
    expect(comp.obtenerOperacionPendiente(101)).toBeTruthy();

    // El backend tiene el registro exitoso (o responde por idempotencia previa al reenvío)
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({
        id_dosis: 101,
        estado: 'INGERIDA',
        efectiva_en: payload1.efectiva_en,
        registrada_en: `${getTodayDateString()}T08:06:00Z`,
        puntual: true,
        nota: 'Toma confirmada',
      } as Dosis)
    );

    // El usuario hace clic en "Verificar" (reconciliación manual que reenvía idempotentemente)
    comp.reconciliarManual();

    // Verifica que se reenvía la clave y cuerpo idénticos de esa operación concreta
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    const [id2, payload2, key2] = treatmentsServiceMock.registrarDosis.mock.calls[1];
    expect(id2).toBe(id1);
    expect(key2).toBe(key1);
    expect(payload2).toEqual(payload1);

    // La operación queda resuelta y se limpia el almacenamiento local
    expect(comp.obtenerOperacionPendiente(101)).toBeNull();
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('17. cerrar y reabrir el modal, y refrescar la vista, no producen inadvertidamente un segundo registro de la misma toma', () => {
    // 1. Envío inicial falla con error de red
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Fallo temporal' } }))
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    const keyOriginal = comp.currentIdempotencyKey();
    comp.modalNota.set('Nota conservada');
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    expect(comp.obtenerOperacionPendiente(101)).toBeTruthy();

    // 2. Paciente cierra el modal sin resolver
    comp.cerrarModal();
    expect(comp.isModalOpen()).toBe(false);

    // 3. Paciente recarga el cronograma (refresco de vista)
    comp.loadCronograma();
    // No se disparó ningún POST adicional
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);

    // 4. Paciente reabre el modal para la misma toma
    comp.abrirModalRegistro(dosis);
    expect(comp.isModalOpen()).toBe(true);

    // La operación pendiente se restaura: misma clave y mismos datos
    expect(comp.currentIdempotencyKey()).toBe(keyOriginal);
    expect(comp.modalNota()).toBe('Nota conservada');
    expect(comp.pendingOperation()).toBeTruthy();

    // 5. El paciente presiona Reintentar
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();

    // Exactamente 2 llamadas en total, la 2da reutiliza la clave idéntica
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    expect(treatmentsServiceMock.registrarDosis.mock.calls[1][2]).toBe(keyOriginal);
    expect(treatmentsServiceMock.registrarDosis.mock.calls[1][1].nota).toBe('Nota conservada');
    expect(comp.obtenerOperacionPendiente(101)).toBeNull();
  });

  it('18. el usuario intenta descartar una operación mientras el primer envío puede seguir en curso; no se crea una segunda operación ni nueva clave', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Simular intento fallido (estado incierto)
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Error temporal' } }))
    );

    comp.abrirModalRegistro(dosis);
    const keyFallida = comp.currentIdempotencyKey();
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    expect(comp.pendingOperation()).toBeTruthy();

    // El usuario intenta descartar la operación pendiente incierta
    comp.descartarOperacionPrevia();

    // NO se debe descartar ni generar una clave nueva mientras siga incierta
    expect(comp.pendingOperation()).not.toBeNull();
    expect(comp.obtenerOperacionPendiente(101)).not.toBeNull();
    expect(comp.currentIdempotencyKey()).toBe(keyFallida);
    expect(comp.modalError()).toContain('No se puede descartar una operación pendiente');

    // No se realiza ninguna segunda llamada al servicio
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
  });

  it('19. una doble pulsación no crea dos solicitudes concurrentes', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);

    // Simulamos que la primera llamada está en curso (isSaving = true)
    comp.isSaving.set(true);

    // Segundo clic inmediato mientras la petición está en vuelo
    comp.guardarRegistro();

    // No se envía una segunda petición
    expect(treatmentsServiceMock.registrarDosis).not.toHaveBeenCalled();
  });

  it('20. el vencimiento del almacenamiento local no habilita por sí solo un nuevo envío potencialmente duplicado', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();

    // Clave de almacenamiento aislada (usuario 42, clínica 1, dosis 101)
    const storageKey = comp.getStorageKey(101);
    expect(storageKey).toBe('pending_dose_42_1_101');

    // Operación guardada hace más de 24 horas (antigüedad superior a PENDING_DOSE_TTL_MS)
    const opExpirada: OperacionDosisPendiente = {
      id_dosis: 101,
      id_tratamiento: 15,
      idempotency_key: 'key-expirada-preservada',
      payload: { estado: 'INGERIDA', nota: 'Operación previa de hace 25h' },
      timestamp: Date.now() - (PENDING_DOSE_TTL_MS + 3600 * 1000), // > 24h
    };
    comp.guardarOperacionPendiente(opExpirada);

    // Invariante: NO se descarta silenciosamente al vencer el TTL; se preserva para evitar duplicados
    const recuperada = comp.obtenerOperacionPendiente(101);
    expect(recuperada).not.toBeNull();
    expect(recuperada?.idempotency_key).toBe('key-expirada-preservada');

    // Al abrir el modal para esa dosis, se restaura la operación pendiente en vez de generar una nueva clave
    const dosis = comp.cronograma()!.dosis[0];
    comp.abrirModalRegistro(dosis);
    expect(comp.currentIdempotencyKey()).toBe('key-expirada-preservada');
    expect(comp.pendingOperation()).not.toBeNull();
  });

  it('21. dosis previamente POSPUESTA: intento de cambio a INGERIDA con respuesta perdida; un GET que aún muestra POSPUESTA no borra la operación pendiente', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();

    // Dosis previamente POSPUESTA
    const dosisPospuesta: Dosis = {
      ...comp.cronograma()!.dosis[0],
      estado: 'POSPUESTA',
    };
    comp.cronograma.set({
      ...comp.cronograma()!,
      dosis: [dosisPospuesta, comp.cronograma()!.dosis[1], comp.cronograma()!.dosis[2]],
    });

    comp.abrirModalRegistro(dosisPospuesta);
    comp.modalEstado.set('INGERIDA');
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));
    comp.modalNota.set('Tomada tarde');

    // Envío a INGERIDA con respuesta perdida (status 0)
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }))
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const opGuardada = comp.obtenerOperacionPendiente(101);
    expect(opGuardada).not.toBeNull();
    expect(opGuardada?.payload.estado).toBe('INGERIDA');

    // Un GET /cronograma devuelve aún POSPUESTA (servidor no terminó o estado previo)
    treatmentsServiceMock.getCronograma.mockReturnValueOnce(
      of({
        ...comp.cronograma()!,
        dosis: [dosisPospuesta, comp.cronograma()!.dosis[1], comp.cronograma()!.dosis[2]],
      })
    );
    comp.loadCronograma();

    // La operación pendiente a INGERIDA NO debe ser borrada por el GET
    expect(comp.obtenerOperacionPendiente(101)).not.toBeNull();
    expect(comp.obtenerOperacionPendiente(101)?.payload.estado).toBe('INGERIDA');
    expect(comp.tieneOperacionGuardada(101)).toBe(true);
  });

  it('22. dosis previamente OMITIDA: intento de cambio a INGERIDA con respuesta perdida; un GET que aún muestra OMITIDA no borra la operación pendiente', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();

    // Dosis previamente OMITIDA
    const dosisOmitida: Dosis = {
      ...comp.cronograma()!.dosis[0],
      estado: 'OMITIDA',
    };
    comp.cronograma.set({
      ...comp.cronograma()!,
      dosis: [dosisOmitida, comp.cronograma()!.dosis[1], comp.cronograma()!.dosis[2]],
    });

    comp.abrirModalRegistro(dosisOmitida);
    comp.modalEstado.set('INGERIDA');
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));
    comp.modalNota.set('Corrección de omisión');

    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Fallo interno' } }))
    );
    comp.guardarRegistro();

    expect(comp.obtenerOperacionPendiente(101)).not.toBeNull();
    expect(comp.obtenerOperacionPendiente(101)?.payload.estado).toBe('INGERIDA');

    // GET que todavía muestra OMITIDA
    treatmentsServiceMock.getCronograma.mockReturnValueOnce(
      of({
        ...comp.cronograma()!,
        dosis: [dosisOmitida, comp.cronograma()!.dosis[1], comp.cronograma()!.dosis[2]],
      })
    );
    comp.loadCronograma();

    // No se borra la operación pendiente
    expect(comp.obtenerOperacionPendiente(101)).not.toBeNull();
    expect(comp.obtenerOperacionPendiente(101)?.payload.estado).toBe('INGERIDA');
    expect(comp.tieneOperacionGuardada(101)).toBe(true);
  });

  it('23. un rechazo definitivo 422 permite corregir los datos y enviar con una clave nueva', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    const keyInicial = comp.currentIdempotencyKey();
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));

    // Backend devuelve 422 (rechazo definitivo por validación de regla de negocio)
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'La fecha y hora efectiva no puede preceder al inicio del plan' },
          })
      )
    );
    comp.guardarRegistro();

    // Se libera la operación pendiente porque el rechazo es definitivo
    expect(comp.pendingOperation()).toBeNull();
    expect(comp.obtenerOperacionPendiente(101)).toBeNull();
    expect(comp.modalError()).toContain('preceder al inicio del plan');

    // Se genera una nueva clave limpia
    const nuevaClave = comp.currentIdempotencyKey();
    expect(nuevaClave).toBeTruthy();
    expect(nuevaClave).not.toBe(keyInicial);

    // El paciente corrige los datos e intenta nuevamente
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 2 * 60 * 1000)));
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    expect(treatmentsServiceMock.registrarDosis.mock.calls[1][2]).toBe(nuevaClave);
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('24. un error de red o falta de conexión offline muestra una explicación clara indicando que el resultado sigue incierto', () => {
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            statusText: 'Unknown Error',
            error: new ProgressEvent('error'),
          })
      )
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));
    comp.guardarRegistro();

    expect(comp.modalError()).toContain('Sin conexión con el servidor');
    expect(comp.modalError()).toContain('incierto');
    expect(comp.pendingOperation()).not.toBeNull();
    expect(comp.obtenerOperacionPendiente(101)).not.toBeNull();
  });

  it('25. nuevo inicio de sesión del mismo usuario y recuperación segura: detecta marcador mínimo cu17_recovery_${userId}_${clinicId}_${idDosis} con datos exclusivamente opacos', () => {
    // Almacenar el marcador mínimo que dejó una sesión previa (usuario 42, clínica 1, dosis 101)
    const markerKey = 'cu17_recovery_42_1_101';
    const markerData = {
      id_dosis: 101,
      id_tratamiento: 15,
      idempotency_key: 'idem-opaca-recuperacion-001',
      timestamp: Date.now() - 3600 * 1000,
      id_usuario: 42,
      id_clinica: 1,
    };
    localStorage.setItem(markerKey, JSON.stringify(markerData));

    // Comprobación de que el marcador contiene estrictamente datos opacos (sin nota ni hora efectiva ni payload clínico)
    const stored = JSON.parse(localStorage.getItem(markerKey)!);
    expect(stored.id_dosis).toBe(101);
    expect(stored.id_tratamiento).toBe(15);
    expect(stored.idempotency_key).toBe('idem-opaca-recuperacion-001');
    expect(stored.payload).toBeUndefined();
    expect(stored.nota).toBeUndefined();
    expect(stored.efectiva_en).toBeUndefined();

    // El mismo usuario inicia sesión e ingresa al cronograma
    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Simular que el endpoint consultarIdempotencia confirma la operación
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        confirmado: true,
        id_dosis: 101,
        idempotency_key: 'idem-opaca-recuperacion-001',
        dosis: { id_dosis: 101, estado: 'INGERIDA' } as Dosis,
      })
    );

    // Al abrir el modal, se detecta el marcador y se dispara automáticamente la verificación segura
    comp.abrirModalRegistro(dosis);

    expect(treatmentsServiceMock.consultarIdempotencia).toHaveBeenCalledWith(101, 'idem-opaca-recuperacion-001');
    // Se limpia el marcador y se notifica el éxito sin duplicar
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();
    expect(comp.toastMessage()?.text).toContain('confirmada en el servidor');
  });

  it('26. inicio de sesión de otro usuario o clínica en el mismo navegador: aislamiento estricto por usuario y clínica', () => {
    // Marcador dejado por el usuario 42 de la clínica 1
    const markerKeyUser42 = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKeyUser42,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'clave-usuario-42',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    // Caso A: Ingresa otro usuario (usuario 99) en la misma clínica 1
    const compOtroUsuario = createComponent(true, '15', 99, 1);
    compOtroUsuario.ngOnInit();
    const dosis = compOtroUsuario.cronograma()!.dosis[0];

    // El usuario 99 no debe ver el marcador del usuario 42
    expect(compOtroUsuario.obtenerMarcadorRecuperacion(101)).toBeNull();
    expect(compOtroUsuario.tieneOperacionGuardada(101)).toBe(false);

    compOtroUsuario.abrirModalRegistro(dosis);
    expect(compOtroUsuario.activeRecoveryMarker()).toBeNull();
    expect(compOtroUsuario.currentIdempotencyKey()).not.toBe('clave-usuario-42');
    expect(treatmentsServiceMock.consultarIdempotencia).not.toHaveBeenCalled();

    compOtroUsuario.cerrarModal();

    // Caso B: El mismo usuario (42) pero autenticado en otra clínica (clínica 2)
    const compOtraClinica = createComponent(true, '15', 42, 2);
    compOtraClinica.ngOnInit();

    expect(compOtraClinica.obtenerMarcadorRecuperacion(101)).toBeNull();
    compOtraClinica.abrirModalRegistro(dosis);
    expect(compOtraClinica.activeRecoveryMarker()).toBeNull();
    expect(compOtraClinica.currentIdempotencyKey()).not.toBe('clave-usuario-42');
  });

  it('27. respuesta perdida con operación confirmada en backend: consultarIdempotencia confirma, limpia marcador y actualiza estado sin duplicar', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-perdida-confirmada',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Backend responde que la operación previa SÍ fue confirmada
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        confirmado: true,
        id_dosis: 101,
        idempotency_key: 'key-perdida-confirmada',
        dosis: {
          id_dosis: 101,
          id_medicamento_plan: 1,
          estado: 'INGERIDA',
          efectiva_en: '2026-10-30T08:05:00-04:00',
          registrada_en: '2026-10-30T12:05:00Z',
          puntual: true,
          nota: 'Confirmada',
        } as Dosis,
      })
    );

    comp.abrirModalRegistro(dosis);

    // Debe invocar el servicio con la clave previa
    expect(treatmentsServiceMock.consultarIdempotencia).toHaveBeenCalledWith(101, 'key-perdida-confirmada');
    // El marcador queda purgado de localStorage
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();
    // Modal cerrado y recarga de cronograma solicitada sin enviar un nuevo POST
    expect(comp.isModalOpen()).toBe(false);
    expect(treatmentsServiceMock.registrarDosis).not.toHaveBeenCalled();
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalled();
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('28. respuesta NO_INICIADA en recuperación preserva marcador ante posible envío en tránsito; resolverOperacionAbandonada libera bloqueo y permite registrar con nueva clave limpia', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-perdida-no-confirmada',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Backend responde NO_INICIADA
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        confirmado: false,
        en_curso: false,
        rechazado: false,
        estado: 'NO_INICIADA',
        id_dosis: 101,
        idempotency_key: 'key-perdida-no-confirmada',
        dosis: null,
      })
    );

    comp.abrirModalRegistro(dosis);

    expect(treatmentsServiceMock.consultarIdempotencia).toHaveBeenCalledWith(101, 'key-perdida-no-confirmada');
    // Invariante crítico: NO se libera el marcador automáticamente ante NO_INICIADA
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(comp.activeRecoveryMarker()).not.toBeNull();
    expect(comp.currentIdempotencyKey()).toBe('key-perdida-no-confirmada');
    expect(comp.modalError()).toContain('en tránsito');

    // El usuario pulsa resolver operación abandonada
    treatmentsServiceMock.resolverOperacionAbandonada.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-perdida-no-confirmada',
        estado: 'RECHAZADA',
        confirmado: false,
        en_curso: false,
        rechazado: true,
        dosis: null,
      })
    );
    comp.resolverOperacionAbandonada();

    expect(treatmentsServiceMock.resolverOperacionAbandonada).toHaveBeenCalledWith(101, 'key-perdida-no-confirmada');
    // Ahora sí se libera el marcador
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();

    // Se asigna una nueva clave limpia diferente de la anterior
    const nuevaClave = comp.currentIdempotencyKey();
    expect(nuevaClave).toBeTruthy();
    expect(nuevaClave).not.toBe('key-perdida-no-confirmada');

    // Ahora el usuario puede registrar normalmente con la nueva clave limpia
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));
    comp.modalNota.set('Registro nuevo tras resolver operación abandonada');
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.iniciarIntento).toHaveBeenCalledWith(101, expect.any(String), nuevaClave);
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    expect(treatmentsServiceMock.registrarDosis.mock.calls[0][2]).toBe(nuevaClave);
    expect(comp.isModalOpen()).toBe(false);
  });

  it('29. falta de conexión durante la recuperación: consulta falla (status 0 / timeout), la dosis permanece bloqueada, el marcador no se borra y se ofrece botón para reintentar verificación', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-offline-recuperacion',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Simular falla de red (status 0) durante la consulta de recuperación
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }))
    );

    comp.abrirModalRegistro(dosis);

    // El marcador NO debe borrarse silenciosamente
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(comp.activeRecoveryMarker()).not.toBeNull();

    // Se informa claramente al usuario y se bloquea el registro nuevo
    expect(comp.modalError()).toContain('Sin conexión con el servidor para verificar la operación previa');
    expect(comp.modalError()).toContain('No se puede registrar una nueva toma');

    // Si el usuario intenta guardar mientras sigue la incertidumbre, la validación lo impide
    // (o intenta re-verificar)
    expect(comp.isSaving()).toBe(false);

    // Botón de reintento: el usuario pulsa verificar cuando vuelve la conexión
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        confirmado: true,
        id_dosis: 101,
        idempotency_key: 'key-offline-recuperacion',
        dosis: { id_dosis: 101, estado: 'INGERIDA' } as Dosis,
      })
    );
    comp.verificarMarcadorRecuperacion();

    expect(treatmentsServiceMock.consultarIdempotencia).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();
    expect(comp.isModalOpen()).toBe(false);
  });

  it('30. imposibilidad de descartar o crear otra clave mientras el resultado anterior siga incierto', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-incierta-no-descartable',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Falla la verificación de red
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0 }))
    );
    comp.abrirModalRegistro(dosis);

    expect(comp.activeRecoveryMarker()).not.toBeNull();
    const claveActual = comp.currentIdempotencyKey();
    expect(claveActual).toBe('key-incierta-no-descartable');

    // El usuario intenta descartar arbitrariamente la operación incierta
    comp.descartarOperacionPrevia();

    // Debe denegarse: el marcador y la clave permanecen intactos
    expect(comp.activeRecoveryMarker()).not.toBeNull();
    expect(comp.currentIdempotencyKey()).toBe('key-incierta-no-descartable');
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(comp.modalError()).toContain('No se puede descartar una operación pendiente');
  });

  it('31. reintento idéntico dentro de una sesión activa (misma dosis, mismo cuerpo y misma Idempotency-Key)', () => {
    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    const hora = formatLocalDateTime(new Date(Date.now() - 10 * 60 * 1000));
    comp.modalHoraEfectiva.set(hora);
    comp.modalNota.set('Toma sesión activa');

    // 1er intento: falla temporal
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'Servicio no disponible' } }))
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const [id1, payload1, key1] = treatmentsServiceMock.registrarDosis.mock.calls[0];

    // 2do intento: usuario pulsa reintentar dentro de la sesión activa
    treatmentsServiceMock.registrarDosis.mockReturnValueOnce(
      of({ id_dosis: 101, estado: 'INGERIDA' } as Dosis)
    );
    comp.guardarRegistro();

    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(2);
    const [id2, payload2, key2] = treatmentsServiceMock.registrarDosis.mock.calls[1];

    expect(id2).toBe(id1);
    expect(key2).toBe(key1);
    expect(payload2).toEqual(payload1);
    expect(comp.isModalOpen()).toBe(false);
  });

  it('32. respuesta EN_CURSO en consultarIdempotencia: no interpreta confirmado: false como rechazo, preserva marcador y mantiene dosis bloqueada', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-en-curso-123',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Servidor responde que la operación previa está EN_CURSO (confirmado: false, pero en_curso: true)
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-en-curso-123',
        estado: 'EN_CURSO',
        confirmado: false,
        en_curso: true,
        rechazado: false,
        dosis: null,
      })
    );

    comp.abrirModalRegistro(dosis);

    // 1. Invocó consultarIdempotencia
    expect(treatmentsServiceMock.consultarIdempotencia).toHaveBeenCalledWith(101, 'key-en-curso-123');

    // 2. ¡NO se elimina el marcador de recuperación!
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(comp.activeRecoveryMarker()).not.toBeNull();

    // 3. ¡NO se genera una nueva clave de idempotencia! Conserva la original
    expect(comp.currentIdempotencyKey()).toBe('key-en-curso-123');

    // 4. Mensaje claro en modalError indicando estado en curso/incierto
    expect(comp.modalError()).toBe(
      'La operación previa sigue en curso o en estado incierto en el servidor. No se permite registrar una nueva toma hasta confirmar el resultado anterior.'
    );

    // 5. Intento de guardarRegistro está bloqueado
    comp.guardarRegistro();
    expect(treatmentsServiceMock.registrarDosis).not.toHaveBeenCalled();
  });

  it('33. respuesta RECHAZADA en consultarIdempotencia: rechazo definitivo limpia marcador, genera nueva clave y muestra mensaje para corregir', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-rechazada-123',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-rechazada-123',
        estado: 'RECHAZADA',
        confirmado: false,
        en_curso: false,
        rechazado: true,
        dosis: null,
        mensaje: 'La dosis no pudo registrarse debido a restricción de ventana horaria.',
      })
    );

    comp.abrirModalRegistro(dosis);

    // 1. Limpia el marcador de recuperación
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();

    // 2. Genera una nueva clave de idempotencia
    expect(comp.currentIdempotencyKey()).toBeTruthy();
    expect(comp.currentIdempotencyKey()).not.toBe('key-rechazada-123');

    // 3. Muestra el mensaje de rechazo para corrección
    expect(comp.modalError()).toBe('La dosis no pudo registrarse debido a restricción de ventana horaria.');
    expect(comp.isModalOpen()).toBe(true);
  });

  it('34. respuesta NO_INICIADA en consultarIdempotencia: no libera marcador ni clave automáticamente ante posible envío en tránsito; resolverOperacionAbandonada libera marcador y desbloquea el formulario', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-no-iniciada-123',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-no-iniciada-123',
        estado: 'NO_INICIADA',
        confirmado: false,
        en_curso: false,
        rechazado: false,
        dosis: null,
      })
    );

    comp.abrirModalRegistro(dosis);

    // Invariante: Preserva marcador y clave ante NO_INICIADA
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(comp.activeRecoveryMarker()).not.toBeNull();
    expect(comp.currentIdempotencyKey()).toBe('key-no-iniciada-123');
    expect(comp.modalError()).toContain('en tránsito');

    // Resolver operación abandonada libera el bloqueo y permite nueva clave
    treatmentsServiceMock.resolverOperacionAbandonada.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-no-iniciada-123',
        estado: 'RECHAZADA',
        confirmado: false,
        en_curso: false,
        rechazado: true,
        dosis: null,
      })
    );
    comp.resolverOperacionAbandonada();

    expect(treatmentsServiceMock.resolverOperacionAbandonada).toHaveBeenCalledWith(101, 'key-no-iniciada-123');
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();
    expect(comp.currentIdempotencyKey()).not.toBe('key-no-iniciada-123');
    expect(comp.isModalOpen()).toBe(true);
    expect(comp.modalEstado()).toBe('INGERIDA');
    expect(comp.toastMessage()?.type).toBe('info');
  });

  it('35. bloqueo de concurrencia: si isReconciling es true, guardarRegistro aborta inmediatamente', () => {
    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.isReconciling.set(true);

    comp.guardarRegistro();
    expect(treatmentsServiceMock.registrarDosis).not.toHaveBeenCalled();
  });

  it('36. respuesta CONFIRMADA en verificarMarcadorRecuperacion: limpia marcador, limpia pendiente, recarga cronograma y cierra modal', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-confirmada-formal',
        timestamp: Date.now(),
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-confirmada-formal',
        estado: 'CONFIRMADA',
        confirmado: true,
        en_curso: false,
        rechazado: false,
        dosis: { id_dosis: 101, estado: 'INGERIDA' } as Dosis,
      })
    );

    comp.abrirModalRegistro(dosis);

    // 1. Limpia marcador de localStorage y signal
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();

    // 2. Limpia operación pendiente
    expect(comp.pendingOperation()).toBeNull();

    // 3. Recarga cronograma
    expect(treatmentsServiceMock.getCronograma).toHaveBeenCalled();

    // 4. Cierra modal
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('37. protocolo de 2 fases: guardarRegistro llama a iniciarIntento con request_hash e Idempotency-Key antes de enviar registrarDosis clínico', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalEstado.set('INGERIDA');
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 10 * 60 * 1000)));
    comp.modalNota.set('Toma protocolo 2 fases');

    comp.guardarRegistro();

    // 1. Inicia intento durable primero
    expect(treatmentsServiceMock.iniciarIntento).toHaveBeenCalledTimes(1);
    const [idIntento, hashIntento, keyIntento] = treatmentsServiceMock.iniciarIntento.mock.calls[0];
    expect(idIntento).toBe(101);
    expect(hashIntento).toMatch(/^[a-f0-9]{64}$/);
    expect(keyIntento).toBeTruthy();

    // 2. Tras éxito durable (EN_CURSO), envía registro clínico
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledTimes(1);
    const [idDosis, payload, keyDosis] = treatmentsServiceMock.registrarDosis.mock.calls[0];
    expect(idDosis).toBe(101);
    expect(keyDosis).toBe(keyIntento);
    expect(payload.estado).toBe('INGERIDA');
    expect(payload.nota).toBe('Toma protocolo 2 fases');

    // 3. Al confirmarse el registro clínico, limpia marcador y cierra modal
    expect(comp.isModalOpen()).toBe(false);
    expect(comp.toastMessage()?.type).toBe('success');
  });

  it('38. protocolo de 2 fases: si iniciarIntento falla con error 409 (conflicto), registrarDosis no se llama y se informa el conflicto', () => {
    treatmentsServiceMock.iniciarIntento.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'Existe una operación en curso o de resultado incierto para esta dosis' },
          })
      )
    );

    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    comp.abrirModalRegistro(dosis);
    comp.modalHoraEfectiva.set(formatLocalDateTime(new Date(Date.now() - 5 * 60 * 1000)));

    comp.guardarRegistro();

    expect(treatmentsServiceMock.iniciarIntento).toHaveBeenCalledTimes(1);
    // registrarDosis NUNCA debe ejecutarse si la fase 1 falla
    expect(treatmentsServiceMock.registrarDosis).not.toHaveBeenCalled();
    expect(comp.modalError()).toContain('Existe una operación en curso');
    expect(comp.isModalOpen()).toBe(true);
  });

  it('39. resolución de operación abandonada: botón o método resolverOperacionAbandonada libera bloqueo y genera nueva clave tras respuesta RECHAZADA', () => {
    const markerKey = 'cu17_recovery_42_1_101';
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        id_dosis: 101,
        id_tratamiento: 15,
        idempotency_key: 'key-abandonada-worker-caido',
        timestamp: Date.now() - 7200 * 1000,
        id_usuario: 42,
        id_clinica: 1,
      })
    );

    const comp = createComponent(true, '15', 42, 1);
    comp.ngOnInit();
    const dosis = comp.cronograma()!.dosis[0];

    // Consulta de recuperación devuelve EN_CURSO
    treatmentsServiceMock.consultarIdempotencia.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-abandonada-worker-caido',
        estado: 'EN_CURSO',
        confirmado: false,
        en_curso: true,
        rechazado: false,
        dosis: null,
      })
    );
    comp.abrirModalRegistro(dosis);

    expect(comp.activeRecoveryMarker()).not.toBeNull();

    // El paciente solicita resolver la operación abandonada
    treatmentsServiceMock.resolverOperacionAbandonada.mockReturnValueOnce(
      of({
        id_dosis: 101,
        idempotency_key: 'key-abandonada-worker-caido',
        estado: 'RECHAZADA',
        confirmado: false,
        en_curso: false,
        rechazado: true,
        dosis: null,
      })
    );
    comp.resolverOperacionAbandonada();

    expect(treatmentsServiceMock.resolverOperacionAbandonada).toHaveBeenCalledWith(101, 'key-abandonada-worker-caido');
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(comp.activeRecoveryMarker()).toBeNull();
    expect(comp.currentIdempotencyKey()).toBeTruthy();
    expect(comp.currentIdempotencyKey()).not.toBe('key-abandonada-worker-caido');
    expect(comp.toastMessage()?.text).toContain('desbloqueado');
  });

  it('40. serializarPayloadDosis y calcularRequestHash producen SHA-256 determinista de 64 caracteres en orden canónico', () => {
    const payload1 = {
      estado: 'INGERIDA' as const,
      efectiva_en: '2026-10-30T10:00:00-04:00',
      nota: 'Con agua',
    };
    const payload2 = {
      nota: 'Con agua',
      estado: 'INGERIDA' as const,
      efectiva_en: '2026-10-30T10:00:00-04:00',
    };

    const serialized1 = serializarPayloadDosis(payload1);
    const serialized2 = serializarPayloadDosis(payload2);
    expect(serialized1).toBe(serialized2);

    const hash1 = calcularRequestHash(payload1);
    const hash2 = calcularRequestHash(payload2);
    expect(hash1).toBe(hash2);
    // Vector calculado con el json.dumps canónico y hashlib.sha256 del backend.
    expect(hash1).toBe('3e634c1c420f02d5082cc2a585e19a50735954faa04c6b6b7e15ff6298b9a325');
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);

    const payloadDiferente = {
      estado: 'OMITIDA' as const,
      nota: 'Olvido',
    };
    const hashDiferente = calcularRequestHash(payloadDiferente);
    expect(hashDiferente).not.toBe(hash1);
    expect(hashDiferente).toMatch(/^[a-f0-9]{64}$/);
  });

  it('41. permite corregir una dosis ingerida mediante intención y clave nueva', () => {
    const comp = createComponent(true, '15');
    comp.ngOnInit();
    const ingerida = comp.cronograma()!.dosis.find((dosis) => dosis.estado === 'INGERIDA')!;

    comp.abrirModalRegistro(ingerida);
    comp.modalEstado.set('POSPUESTA');
    comp.modalNota.set('Corrección del registro');
    comp.guardarRegistro();

    expect(treatmentsServiceMock.iniciarIntento).toHaveBeenCalledWith(
      ingerida.id_dosis, expect.any(String), expect.any(String)
    );
    expect(treatmentsServiceMock.registrarDosis).toHaveBeenCalledWith(
      ingerida.id_dosis,
      { estado: 'POSPUESTA', nota: 'Corrección del registro' },
      expect.any(String)
    );
  });
});
