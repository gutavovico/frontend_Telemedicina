import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { TreatmentsService } from '../../services/treatments.service';
import { TreatmentAlerts } from './treatment-alerts';
import {
  Aviso,
  AvisoListResponse,
  AvisoQueryParams,
  TipoAviso,
} from '../../models/treatment.models';

function mockAviso(
  id: number,
  tipo: TipoAviso = 'RECORDATORIO',
  leidaEn: string | null = null
): Aviso {
  return {
    id_aviso: id,
    id_tratamiento: 101,
    id_dosis: 202,
    tipo,
    canal: 'WEB',
    titulo: `Aviso ${tipo}`,
    mensaje: `Mensaje de prueba para aviso ${tipo}`,
    estado: 'ENVIADO',
    programada_en: '2026-11-01T08:00:00Z',
    enviada_en: '2026-11-01T08:00:05Z',
    leida_en: leidaEn,
  };
}

describe('TreatmentAlerts (CU17)', () => {
  const serviceMock = {
    listAvisos: vi.fn((_params: AvisoQueryParams = {}) =>
      of({ items: [] as Aviso[], total: 0 } as AvisoListResponse)
    ),
    marcarAvisoLeido: vi.fn((_idAviso: number) =>
      of(mockAviso(1, 'RECORDATORIO', '2026-11-01T08:30:00Z'))
    ),
  };
  const routerMock = { navigate: vi.fn() };
  const authMock = {
    userRole: vi.fn(() => 'paciente'),
    isDoctor: vi.fn(() => false),
    isPaciente: vi.fn(() => true),
  };
  let injector: DestroyableInjector;

  function createComponent(): TreatmentAlerts {
    injector = Injector.create({
      providers: [
        { provide: TreatmentsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    return runInInjectionContext(injector, () => new TreatmentAlerts());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.listAvisos.mockReturnValue(of({ items: [] as Aviso[], total: 0 }));
    serviceMock.marcarAvisoLeido.mockReturnValue(
      of(mockAviso(1, 'RECORDATORIO', '2026-11-01T08:30:00Z'))
    );
  });

  it('carga inicial lista de avisos y actualiza señales', () => {
    const lista = [
      mockAviso(1, 'RECORDATORIO', null),
      mockAviso(2, 'OMISION', '2026-11-01T09:00:00Z'),
    ];
    serviceMock.listAvisos.mockReturnValueOnce(of({ items: lista, total: 2 }));

    const comp = createComponent();
    comp.ngOnInit();

    expect(serviceMock.listAvisos).toHaveBeenCalled();
    expect(comp.avisos().length).toBe(2);
    expect(comp.total()).toBe(2);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('maneja estado vacío sin error', () => {
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.avisos()).toEqual([]);
    expect(comp.total()).toBe(0);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('captura y muestra mensaje ante error del backend', () => {
    const errorRes = new HttpErrorResponse({
      status: 500,
      error: { detail: 'Error al consultar avisos' },
    });
    serviceMock.listAvisos.mockReturnValueOnce(throwError(() => errorRes));

    const comp = createComponent();
    comp.loadAvisos(1);

    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBe('Error al consultar avisos');
    injector.destroy();
  });

  describe('Filtros de Lectura', () => {
    it('filtra solo no leídos enviando no_leidos: true', () => {
      const comp = createComponent();
      comp.setFilter(true);

      expect(comp.soloNoLeidos()).toBe(true);
      const calls = serviceMock.listAvisos.mock.calls as unknown as Array<[AvisoQueryParams]>;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.no_leidos).toBe(true);
      expect(comp.page()).toBe(1);
      injector.destroy();
    });

    it('cambia a todos los avisos enviando no_leidos: undefined', () => {
      const comp = createComponent();
      comp.setFilter(true);
      comp.setFilter(false);

      expect(comp.soloNoLeidos()).toBe(false);
      const calls = serviceMock.listAvisos.mock.calls as unknown as Array<[AvisoQueryParams]>;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.no_leidos).toBeUndefined();
      injector.destroy();
    });
  });

  describe('Estilos e Iconos según Tipo de Aviso', () => {
    it('configura RECORDATORIO con icono alarm y estilo teal/azul', () => {
      const comp = createComponent();
      const cfg = comp.getTipoConfig('RECORDATORIO');

      expect(cfg.icon).toBe('alarm');
      expect(cfg.label).toContain('Recordatorio');
      expect(cfg.badgeClass).toContain('teal');
      expect(cfg.cardBorderClass).toContain('#049CAB');
      injector.destroy();
    });

    it('configura OMISION con icono warning y estilo ambar/naranja', () => {
      const comp = createComponent();
      const cfg = comp.getTipoConfig('OMISION');

      expect(cfg.icon).toBe('warning');
      expect(cfg.label).toContain('Omisión');
      expect(cfg.badgeClass).toContain('amber');
      expect(cfg.cardBorderClass).toContain('amber');
      injector.destroy();
    });

    it('configura RIESGO_ABANDONO con icono crisis_alert y estilo rojo', () => {
      const comp = createComponent();
      const cfg = comp.getTipoConfig('RIESGO_ABANDONO');

      expect(cfg.icon).toBe('crisis_alert');
      expect(cfg.label).toContain('Riesgo de abandono');
      expect(cfg.badgeClass).toContain('rose');
      expect(cfg.cardBorderClass).toContain('rose');
      injector.destroy();
    });
  });

  describe('Marcar Aviso como Leído', () => {
    it('marca un aviso no leído y actualiza su estado en modo "todos"', () => {
      const comp = createComponent();
      const aviso = mockAviso(10, 'RECORDATORIO', null);
      comp.avisos.set([aviso]);
      comp.soloNoLeidos.set(false);

      const fechaLeida = '2026-11-01T10:00:00Z';
      serviceMock.marcarAvisoLeido.mockReturnValueOnce(
        of(mockAviso(10, 'RECORDATORIO', fechaLeida))
      );

      comp.marcarLeido(aviso);

      expect(serviceMock.marcarAvisoLeido).toHaveBeenCalledWith(10);
      const actualizado = comp.avisos().find((a) => a.id_aviso === 10);
      expect(actualizado?.leida_en).toBe(fechaLeida);
      expect(comp.marcandoIds().has(10)).toBe(false);
      injector.destroy();
    });

    it('en modo "solo no leídos", remueve el aviso marcado de la lista y decrementa total', () => {
      const comp = createComponent();
      const aviso = mockAviso(15, 'OMISION', null);
      comp.avisos.set([aviso]);
      comp.total.set(1);
      comp.soloNoLeidos.set(true);

      serviceMock.marcarAvisoLeido.mockReturnValueOnce(
        of(mockAviso(15, 'OMISION', '2026-11-01T11:00:00Z'))
      );

      comp.marcarLeido(aviso);

      expect(serviceMock.marcarAvisoLeido).toHaveBeenCalledWith(15);
      expect(comp.avisos().length).toBe(0);
      expect(comp.total()).toBe(0);
      injector.destroy();
    });

    it('no llama al servicio si el aviso ya fue leído o ya se está procesando', () => {
      const comp = createComponent();
      const yaLeido = mockAviso(20, 'RECORDATORIO', '2026-11-01T09:00:00Z');

      comp.marcarLeido(yaLeido);
      expect(serviceMock.marcarAvisoLeido).not.toHaveBeenCalled();

      const enProceso = mockAviso(21, 'RECORDATORIO', null);
      comp.marcandoIds.set(new Set([21]));
      comp.marcarLeido(enProceso);
      expect(serviceMock.marcarAvisoLeido).not.toHaveBeenCalled();

      injector.destroy();
    });

    it('captura error si falla marcarAvisoLeido y limpia el estado de marcando', () => {
      const comp = createComponent();
      const aviso = mockAviso(30, 'RIESGO_ABANDONO', null);
      comp.avisos.set([aviso]);

      serviceMock.marcarAvisoLeido.mockReturnValueOnce(
        throwError(() => new Error('Fallo de red'))
      );

      comp.marcarLeido(aviso);

      expect(comp.errorMessage()).toContain('No fue posible marcar el aviso como leído');
      expect(comp.marcandoIds().has(30)).toBe(false);
      injector.destroy();
    });
  });

  describe('Paginación', () => {
    it('calcula skip y limit correctamente al paginar', () => {
      serviceMock.listAvisos.mockReturnValue(
        of({ items: [] as Aviso[], total: 30 } as AvisoListResponse)
      );
      const comp = createComponent();
      comp.limit.set(10);
      comp.total.set(30);

      comp.loadAvisos(2);
      let calls = serviceMock.listAvisos.mock.calls as unknown as Array<[AvisoQueryParams]>;
      let lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.skip).toBe(10);
      expect(lastArgs.limit).toBe(10);
      expect(comp.page()).toBe(2);

      comp.nextPage();
      calls = serviceMock.listAvisos.mock.calls as unknown as Array<[AvisoQueryParams]>;
      lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.skip).toBe(20);
      expect(comp.page()).toBe(3);

      comp.prevPage();
      calls = serviceMock.listAvisos.mock.calls as unknown as Array<[AvisoQueryParams]>;
      lastArgs = calls[calls.length - 1][0];
      expect(lastArgs.skip).toBe(10);
      expect(comp.page()).toBe(2);

      injector.destroy();
    });
  });
});
