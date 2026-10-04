import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { documentAccessGuard } from './document-access.guard';

describe('documentAccessGuard (CU12)', () => {
  const routerMock = { createUrlTree: vi.fn(() => 'TREE') };
  const authMock = { isLoggedIn: vi.fn(), userRole: vi.fn() };

  function runGuard(routeData: Record<string, unknown>): unknown {
    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authMock }
      ]
    });
    try {
      return runInInjectionContext(injector, () =>
        documentAccessGuard(
          { data: routeData } as unknown as ActivatedRouteSnapshot,
          { url: '/documentos' } as never
        )
      );
    } finally {
      injector.destroy();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isLoggedIn.mockReturnValue(true);
    authMock.userRole.mockReturnValue('medico');
  });

  it('redirige a /login si no hay sesión', () => {
    authMock.isLoggedIn.mockReturnValue(false);
    const result = runGuard({});
    expect(result).toBe('TREE');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/documentos' }
    });
  });

  it('permite si no se exige rol', () => {
    expect(runGuard({})).toBe(true);
  });

it('permite si el rol coincide (insensible a mayúsculas de la ruta)', () => {
      authMock.userRole.mockReturnValue('medico');
      expect(runGuard({ roles: ['Medico'] })).toBe(true);
    });

  it('bloquea si el rol no está permitido', () => {
    const result = runGuard({ roles: ['ADMIN'] });
    expect(result).toBe('TREE');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});