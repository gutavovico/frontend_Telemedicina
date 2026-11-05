import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';
import { TreatmentsService } from '../../services/treatments.service';
import { PrescriptionsService } from '../../../prescriptions/services/prescriptions.service';
import {
  TreatmentCreate,
  calcularEquidistancia,
  calcularDias,
  getTodayDateString,
  getDefaultEndDateString,
} from './treatment-create';
import { Plan } from '../../models/treatment.models';

describe('TreatmentCreate (CU17)', () => {
  let injector: DestroyableInjector;
  let comp: TreatmentCreate;

  const routerMock = {
    navigate: vi.fn(),
  };

  const authServiceMock = {
    isDoctor: vi.fn(() => true),
  };

  const treatmentsServiceMock = {
    createPlan: vi.fn(),
  };

  const prescriptionsServiceMock = {
    getPrescription: vi.fn(),
  };

  let queryParamsMap: Record<string, string> = {};

  const routeMock = {
    snapshot: {
      queryParamMap: {
        get: vi.fn((key: string): string | null => queryParamsMap[key] ?? null),
      },
    },
  };

  function createComponent(isDoctor = true): TreatmentCreate {
    authServiceMock.isDoctor.mockReturnValue(isDoctor);
    injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: TreatmentsService, useValue: treatmentsServiceMock },
        { provide: PrescriptionsService, useValue: prescriptionsServiceMock },
      ],
    });
    return runInInjectionContext(injector, () => new TreatmentCreate());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryParamsMap = {};
  });

  describe('1. Control de Acceso y Autorización', () => {
    it('permite el acceso si el usuario es médico tratante', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      expect(comp.authService.isDoctor()).toBe(true);
      expect(routerMock.navigate).not.toHaveBeenCalled();
      expect(comp.errorMessage()).toBeNull();
    });

    it('deniega acceso y redirige a la raíz si el usuario no es médico', () => {
      comp = createComponent(false);
      comp.ngOnInit();
      expect(comp.authService.isDoctor()).toBe(false);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
      expect(comp.errorMessage()).toContain('Acceso denegado');
    });
  });

  describe('2. Inicialización y Lectura de Parámetros de Ruta', () => {
    it('precarga valores por defecto: fecha_inicio hoy y zona America/La_Paz', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      expect(comp.fechaInicio()).toBe(getTodayDateString());
      expect(comp.fechaFin()).toBe(getDefaultEndDateString(14));
      expect(comp.zonaHoraria()).toBe('America/La_Paz');
      expect(comp.idConsulta()).toBeNull();
      expect(comp.idReceta()).toBeNull();
      expect(comp.medicamentos().length).toBe(0);
    });

    it('extrae id_consulta, id_receta e id_diagnostico desde query params e inicializa horas_locales vacío', () => {
      queryParamsMap = {
        id_consulta: '42',
        id_receta: '81',
        id_diagnostico: '10',
      };
      prescriptionsServiceMock.getPrescription.mockReturnValue(
        of({
          id_receta: 81,
          folio: 'REC-2026-0081',
          detalles: [
            {
              id_receta_detalle: 121,
              medicamento_nombre: 'Amoxicilina 500mg',
              frecuencia: 'c/8h',
              indicaciones: 'Con alimentos',
            },
          ],
        })
      );

      comp = createComponent(true);
      comp.ngOnInit();

      expect(comp.idConsulta()).toBe(42);
      expect(comp.idReceta()).toBe(81);
      expect(comp.idDiagnostico()).toBe(10);
      expect(comp.tieneReceta()).toBe(true);
      expect(comp.medicamentos().length).toBe(1);
      expect(comp.medicamentos()[0].id_receta_detalle).toBe(121);
      expect(comp.medicamentos()[0].medicamento_nombre).toBe('Amoxicilina 500mg');
      // No infiere automáticamente: inicia vacío para confirmación explícita del médico
      expect(comp.medicamentos()[0].horas_locales).toEqual([]);
      expect(comp.medicamentos()[0].frecuencia_receta).toBe('c/8h');
    });

    it('la carga de receta no infiere horas automáticamente y exige selección explícita antes de enviar', () => {
      prescriptionsServiceMock.getPrescription.mockReturnValue(
        of({
          id_receta: 81,
          folio: 'REC-2026-0081',
          detalles: [
            {
              id_receta_detalle: 121,
              medicamento_nombre: 'Amoxicilina 500mg',
              frecuencia: 'c/8h',
              indicaciones: 'Con alimentos',
            },
          ],
        })
      );

      comp = createComponent(true);
      comp.idConsulta.set(42);
      comp.idReceta.set(81);
      comp.cargarReceta();

      expect(comp.medicamentos()[0].horas_locales).toEqual([]);

      // Si el médico intenta enviar sin configurar horas, el formulario es inválido
      const errorPrevio = comp.validarFormulario();
      expect(errorPrevio).toContain('debe tener al menos una hora programada en el horario');

      // El médico selecciona explícitamente el preset rápido c/8h
      comp.aplicarPreset(0, '8h');
      expect(comp.medicamentos()[0].horas_locales).toEqual(['00:00', '08:00', '16:00']);

      // Tras la configuración explícita, la validación pasa
      expect(comp.validarFormulario()).toBeNull();
    });
  });

  describe('3. Pautas Horarias, Presets y Cálculo de Equidistancia', () => {
    it('calcularEquidistancia detecta tomas uniformes a lo largo de 24 horas', () => {
      // 1 toma diaria (cada 24 horas)
      expect(calcularEquidistancia(['08:00'])).toEqual({
        esEquidistante: true,
        texto: 'Cada 24 horas',
        intervaloHoras: 24,
      });

      // 2 tomas diarias espaciadas 12h (cada 12 horas)
      expect(calcularEquidistancia(['08:00', '20:00'])).toEqual({
        esEquidistante: true,
        texto: 'Cada 12 horas',
        intervaloHoras: 12,
      });

      // 3 tomas diarias espaciadas 8h (cada 8 horas)
      expect(calcularEquidistancia(['00:00', '08:00', '16:00'])).toEqual({
        esEquidistante: true,
        texto: 'Cada 8 horas',
        intervaloHoras: 8,
      });

      // 4 tomas diarias espaciadas 6h (cada 6 horas)
      expect(calcularEquidistancia(['00:00', '06:00', '12:00', '18:00'])).toEqual({
        esEquidistante: true,
        texto: 'Cada 6 horas',
        intervaloHoras: 6,
      });
    });

    it('calcularEquidistancia detecta horarios irregulares / personalizados', () => {
      // 08:00 y 14:00 (diferencia 6h y wrap 18h -> no uniforme)
      expect(calcularEquidistancia(['08:00', '14:00'])).toEqual({
        esEquidistante: false,
        texto: 'Horario personalizado',
        intervaloHoras: null,
      });

      // Lista vacía
      expect(calcularEquidistancia([])).toEqual({
        esEquidistante: false,
        texto: 'Sin tomas',
        intervaloHoras: null,
      });
    });

    it('permite aplicar presets cómodos (8h, 12h, 24h, 6h)', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.agregarMedicamento();

      // Preset 8h
      comp.aplicarPreset(0, '8h');
      expect(comp.medicamentos()[0].horas_locales).toEqual(['00:00', '08:00', '16:00']);
      expect(comp.obtenerEquidistancia(comp.medicamentos()[0].horas_locales).texto).toBe('Cada 8 horas');

      // Preset 12h
      comp.aplicarPreset(0, '12h');
      expect(comp.medicamentos()[0].horas_locales).toEqual(['08:00', '20:00']);
      expect(comp.obtenerEquidistancia(comp.medicamentos()[0].horas_locales).texto).toBe('Cada 12 horas');

      // Preset 24h
      comp.aplicarPreset(0, '24h');
      expect(comp.medicamentos()[0].horas_locales).toEqual(['08:00']);
      expect(comp.obtenerEquidistancia(comp.medicamentos()[0].horas_locales).texto).toBe('Cada 24 horas');
    });

    it('permite añadir y quitar tomas manuales manteniendo el orden y unicidad', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.agregarMedicamento();
      comp.aplicarPreset(0, '24h'); // ['08:00']

      // Añadir 20:00 -> ordenado ['08:00', '20:00']
      comp.agregarHora(0, '20:00');
      expect(comp.medicamentos()[0].horas_locales).toEqual(['08:00', '20:00']);

      // Añadir 14:00 -> ordenado ['08:00', '14:00', '20:00']
      comp.agregarHora(0, '14:00');
      expect(comp.medicamentos()[0].horas_locales).toEqual(['08:00', '14:00', '20:00']);

      // Intentar añadir duplicado
      comp.agregarHora(0, '14:00');
      expect(comp.errorMessage()).toContain('ya está programada');
      expect(comp.medicamentos()[0].horas_locales.length).toBe(3);

      // Quitar hora en índice 1 (14:00)
      comp.quitarHora(0, 1);
      expect(comp.medicamentos()[0].horas_locales).toEqual(['08:00', '20:00']);
    });
  });

  describe('4. Validaciones del Formulario', () => {
    it('valida que id_consulta sea obligatorio', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(null);

      const error = comp.validarFormulario();
      expect(error).toContain('ID de consulta es obligatorio');
    });

    it('valida que fecha_fin sea mayor o igual a fecha_inicio', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(10);
      comp.fechaInicio.set('2026-11-10');
      comp.fechaFin.set('2026-11-05');

      const error = comp.validarFormulario();
      expect(error).toContain('fecha de fin debe ser mayor o igual');
    });

    it('valida que la duración del plan no exceda los 366 días', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(10);
      comp.fechaInicio.set('2026-01-01');
      comp.fechaFin.set('2027-02-15'); // más de 366 días

      const error = comp.validarFormulario();
      expect(error).toContain('no puede exceder los 366 días');
    });

    it('exige al menos un medicamento si hay receta asociada', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(10);
      comp.idReceta.set(50);
      comp.tieneReceta.set(true);
      comp.medicamentos.set([]);

      const error = comp.validarFormulario();
      expect(error).toContain('debe incluir al menos un medicamento');
    });

    it('valida que cada medicamento tenga horarios definidos y válidos', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(10);
      comp.idReceta.set(50);
      comp.tieneReceta.set(true);
      comp.medicamentos.set([
        {
          id_receta_detalle: 1,
          medicamento_nombre: 'Ibuprofeno',
          fecha_inicio: '2026-11-01',
          fecha_fin: '2026-11-05',
          horas_locales: [],
          indicaciones: '',
        },
      ]);

      const error = comp.validarFormulario();
      expect(error).toContain('debe tener al menos una hora programada');
    });
  });

  describe('5. Envío y Creación del Plan (createPlan)', () => {
    it('crea exitosamente un plan sin fármacos (no farmacológico) cuando no hay receta', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(15);
      comp.idReceta.set(null);
      comp.tieneReceta.set(false);
      comp.fechaInicio.set('2026-11-01');
      comp.fechaFin.set('2026-11-15');
      comp.zonaHoraria.set('America/La_Paz');
      comp.notas.set('Reposo e hidratación');

      const mockPlan: Partial<Plan> = {
        id_tratamiento: 99,
        id_consulta: 15,
        id_receta: null,
      };
      treatmentsServiceMock.createPlan.mockReturnValue(of(mockPlan));

      comp.onSubmit();

      expect(treatmentsServiceMock.createPlan).toHaveBeenCalledWith({
        id_consulta: 15,
        id_receta: null,
        id_diagnostico: null,
        fecha_inicio: '2026-11-01',
        fecha_fin: '2026-11-15',
        zona_horaria: 'America/La_Paz',
        notas: 'Reposo e hidratación',
        medicamentos: [],
      });
      expect(comp.successMessage()).toContain('creado exitosamente');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/tratamientos', 99]);
    });

    it('crea exitosamente un plan con fármacos cuando hay receta asociada', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(20);
      comp.idReceta.set(88);
      comp.tieneReceta.set(true);
      comp.fechaInicio.set('2026-11-01');
      comp.fechaFin.set('2026-11-10');
      comp.medicamentos.set([
        {
          id_receta_detalle: 101,
          medicamento_nombre: 'Paracetamol 500mg',
          fecha_inicio: '2026-11-01',
          fecha_fin: '2026-11-07',
          horas_locales: ['08:00', '20:00'],
          indicaciones: 'Cada 12h con comida',
        },
      ]);

      const mockPlan: Partial<Plan> = {
        id_tratamiento: 105,
        id_consulta: 20,
        id_receta: 88,
      };
      treatmentsServiceMock.createPlan.mockReturnValue(of(mockPlan));

      comp.onSubmit();

      expect(treatmentsServiceMock.createPlan).toHaveBeenCalledWith({
        id_consulta: 20,
        id_receta: 88,
        id_diagnostico: null,
        fecha_inicio: '2026-11-01',
        fecha_fin: '2026-11-10',
        zona_horaria: 'America/La_Paz',
        notas: null,
        medicamentos: [
          {
            id_receta_detalle: 101,
            fecha_inicio: '2026-11-01',
            fecha_fin: '2026-11-07',
            horas_locales: ['08:00', '20:00'],
            indicaciones: 'Cada 12h con comida',
          },
        ],
      });
      expect(routerMock.navigate).toHaveBeenCalledWith(['/tratamientos', 105]);
    });

    it('muestra el detalle de error devuelto por la API cuando la solicitud falla', () => {
      comp = createComponent(true);
      comp.ngOnInit();
      comp.idConsulta.set(20);

      treatmentsServiceMock.createPlan.mockReturnValue(
        throwError(() => ({
          error: { detail: 'La consulta ya tiene un plan de tratamiento activo.' },
        }))
      );

      comp.onSubmit();

      expect(comp.errorMessage()).toBe('La consulta ya tiene un plan de tratamiento activo.');
      expect(comp.isSubmitting()).toBe(false);
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });
});
