import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { TreatmentsService } from './treatments.service';
import {
  PlanCreate,
  RegistroDosis,
  EvolucionCreate,
  MotivoClinico,
  VigenciaUpdate,
} from '../models/treatment.models';

type FakeHttp = Record<'get' | 'post' | 'patch', ReturnType<typeof vi.fn>>;

const BASE_URL = `${environment.apiUrl}/api/v1/tratamientos`;

function createHttp(): FakeHttp {
  return {
    get: vi.fn(() => of({})),
    post: vi.fn(() => of({})),
    patch: vi.fn(() => of({})),
  };
}

let http: FakeHttp;
let service: TreatmentsService;
let injector: DestroyableInjector;

function instantiate(): TreatmentsService {
  injector = Injector.create({ providers: [{ provide: HttpClient, useValue: http }] });
  return runInInjectionContext(injector, () => new TreatmentsService());
}

describe('TreatmentsService (CU17)', () => {
  beforeEach(() => {
    http = createHttp();
    service = instantiate();
  });

  afterEach(() => {
    injector.destroy();
    vi.restoreAllMocks();
  });

  it('1. lista tratamientos con paginación y filtros', () => {
    http.get.mockReturnValueOnce(of({ items: [], total: 0 }));
    service.listPlans({ skip: 10, limit: 5, estado: 'ACTIVO', id_paciente: 42 }).subscribe();

    expect(http.get).toHaveBeenCalledWith(BASE_URL, {
      params: expect.objectContaining({}),
    });
    const [, opts] = http.get.mock.calls[0] as [
      string,
      { params: { get: (k: string) => string | null } },
    ];
    expect(opts.params.get('skip')).toBe('10');
    expect(opts.params.get('limit')).toBe('5');
    expect(opts.params.get('estado')).toBe('ACTIVO');
    expect(opts.params.get('id_paciente')).toBe('42');
  });

  it('2. obtiene detalle de plan por ID', () => {
    http.get.mockReturnValueOnce(of({ id_tratamiento: 15 }));
    service.getPlan(15).subscribe();

    expect(http.get).toHaveBeenCalledWith(`${BASE_URL}/15`);
  });

  it('3. crea plan terapéutico', () => {
    const payload: PlanCreate = {
      id_consulta: 1,
      id_receta: 2,
      id_diagnostico: 3,
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-14',
      zona_horaria: 'America/La_Paz',
      medicamentos: [
        {
          id_receta_detalle: 10,
          fecha_inicio: '2026-11-01',
          fecha_fin: '2026-11-07',
          horas_locales: ['08:00', '16:00', '00:00'],
        },
      ],
    };
    http.post.mockReturnValueOnce(of({ id_tratamiento: 99 }));
    service.createPlan(payload).subscribe();

    expect(http.post).toHaveBeenCalledWith(BASE_URL, payload);
  });

  it('4. consulta cronograma de una fecha', () => {
    http.get.mockReturnValueOnce(of({ id_tratamiento: 15, dosis: [] }));
    service.getCronograma(15, '2026-11-01').subscribe();

    const [url, opts] = http.get.mock.calls[0] as [
      string,
      { params: { get: (k: string) => string | null } },
    ];
    expect(url).toBe(`${BASE_URL}/15/cronograma`);
    expect(opts.params.get('fecha')).toBe('2026-11-01');
  });

  it('5. registra dosis con Idempotency-Key en headers', () => {
    const payload: RegistroDosis = {
      estado: 'INGERIDA',
      efectiva_en: '2026-11-01T08:05:00-04:00',
      nota: 'Sin novedad',
    };
    http.post.mockReturnValueOnce(of({ id_dosis: 100 }));
    service.registrarDosis(100, payload, 'key-abc-123').subscribe();

    expect(http.post).toHaveBeenCalledWith(
      `${BASE_URL}/dosis/100/registros`,
      payload,
      expect.objectContaining({
        headers: expect.anything(),
      })
    );
    const [, , opts] = http.post.mock.calls[0] as [
      string,
      unknown,
      { headers: { get: (k: string) => string | null } },
    ];
    expect(opts.headers.get('Idempotency-Key')).toBe('key-abc-123');
  });

  it('6. registra evolución médica', () => {
    const payload: EvolucionCreate = { nota: 'Evolución favorable del paciente.' };
    http.post.mockReturnValueOnce(of({ id_evento: 5 }));
    service.registrarEvolucion(15, payload).subscribe();

    expect(http.post).toHaveBeenCalledWith(`${BASE_URL}/15/evoluciones`, payload);
  });

  it('7. suspende y reactiva medicamento', () => {
    const motivo: MotivoClinico = { motivo: 'Efectos adversos leves reportados.' };
    http.post.mockReturnValue(of({ id_tratamiento: 15 }));

    service.suspenderMedicamento(15, 31, motivo).subscribe();
    expect(http.post).toHaveBeenCalledWith(`${BASE_URL}/15/medicamentos/31/suspender`, motivo);

    service.reactivarMedicamento(15, 31, motivo).subscribe();
    expect(http.post).toHaveBeenCalledWith(`${BASE_URL}/15/medicamentos/31/reactivar`, motivo);
  });

  it('8. actualiza vigencia con prórroga', () => {
    const update: VigenciaUpdate = {
      fecha_fin: '2026-11-28',
      motivo: 'Ampliación de tratamiento ambulatorio',
      medicamentos: [{ id_medicamento_plan: 31, fecha_fin: '2026-11-28' }],
    };
    http.patch.mockReturnValueOnce(of({ id_tratamiento: 15 }));
    service.actualizarVigencia(15, update).subscribe();

    expect(http.patch).toHaveBeenCalledWith(`${BASE_URL}/15/vigencia`, update);
  });

  it('9. finaliza plan con motivo', () => {
    const motivo: MotivoClinico = { motivo: 'Paciente recuperado satisfactoriamente.' };
    http.post.mockReturnValueOnce(of({ id_tratamiento: 15 }));
    service.finalizarPlan(15, motivo).subscribe();

    expect(http.post).toHaveBeenCalledWith(`${BASE_URL}/15/finalizar`, motivo);
  });

  it('10. consulta avisos y marca como leído', () => {
    http.get.mockReturnValueOnce(of({ items: [], total: 0 }));
    service.listAvisos({ no_leidos: true }).subscribe();

    const [url, opts] = http.get.mock.calls[0] as [
      string,
      { params: { get: (k: string) => string | null } },
    ];
    expect(url).toBe(`${BASE_URL}/avisos`);
    expect(opts.params.get('no_leidos')).toBe('true');

    http.patch.mockReturnValueOnce(of({ id_aviso: 7 }));
    service.marcarAvisoLeido(7).subscribe();
    expect(http.patch).toHaveBeenCalledWith(`${BASE_URL}/avisos/7/leer`, {});
  });

  it('11. consulta estado de idempotencia para dosis y clave', () => {
    const mockResponse = {
      id_dosis: 101,
      idempotency_key: 'key-test-123',
      estado: 'CONFIRMADA' as const,
      confirmado: true,
      en_curso: false,
      rechazado: false,
      dosis: { id_dosis: 101, estado: 'INGERIDA' as const } as any,
      mensaje: null,
    };
    http.get.mockReturnValueOnce(of(mockResponse));

    service.consultarIdempotencia(101, 'key-test-123').subscribe((res) => {
      expect(res.estado).toBe('CONFIRMADA');
      expect(res.confirmado).toBe(true);
      expect(res.id_dosis).toBe(101);
    });

    expect(http.get).toHaveBeenCalledWith(`${BASE_URL}/dosis/101/registros/idempotencia/key-test-123`);
  });
});