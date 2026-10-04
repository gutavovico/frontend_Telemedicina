import { describe, it, expect } from 'vitest';
import type { Route } from '@angular/router';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { PrescriptionIssue } from './features/medical-records/prescriptions/pages/prescription-issue/prescription-issue';

function indice(path: string): number {
  return routes.findIndex((r: Route) => r.path === path);
}

describe('Orden de rutas CU16 (hallazgo 5)', () => {
  it('/recetas/emitir precede a /recetas/:id y a /recetas', () => {
    const emitir = indice('recetas/emitir');
    const detalle = indice('recetas/:id');
    const listado = indice('recetas');
    expect(emitir).toBeGreaterThanOrEqual(0);
    expect(detalle).toBeGreaterThanOrEqual(0);
    expect(listado).toBeGreaterThanOrEqual(0);
    expect(emitir).toBeLessThan(detalle);
    expect(detalle).toBeLessThan(listado);
  });

  it('/recetas/emitir carga PrescriptionIssue y no se interpreta como ID', async () => {
    const emitir = routes.find((r: Route) => r.path === 'recetas/emitir');
    expect(emitir?.loadComponent).toBeDefined();
    const component = await emitir?.loadComponent?.();
    expect(component).toBe(PrescriptionIssue);
    // La ruta parametrizada está después: 'emitir' nunca cae en `:id`.
    expect(indice('recetas/emitir')).toBeLessThan(indice('recetas/:id'));
  });

  it('la emisión exige únicamente rol doctor', () => {
    const emitir = routes.find((r: Route) => r.path === 'recetas/emitir');
    expect(emitir?.data?.['roles']).toEqual(['doctor']);
  });

  it('la validación pública continúa sin authGuard', () => {
    const publica = routes.find((r: Route) => r.path === 'validar-receta/:codigo');
    expect(publica).toBeDefined();
    expect(publica?.canActivate ?? []).toEqual([]);
  });

  it('server routes replica el orden emitir, :id, base', () => {
    const paths = serverRoutes.map((r) => r.path);
    const emitir = paths.indexOf('recetas/emitir');
    const detalle = paths.indexOf('recetas/:id');
    const listado = paths.indexOf('recetas');
    expect(emitir).toBeGreaterThanOrEqual(0);
    expect(emitir).toBeLessThan(detalle);
    expect(detalle).toBeLessThan(listado);
  });
});
