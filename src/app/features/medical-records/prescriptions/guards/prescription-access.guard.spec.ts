import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { prescriptionAccessGuard } from './prescription-access.guard';

describe('prescriptionAccessGuard (CU16)', () => {
  const routerMock = { createUrlTree: vi.fn(() => 'TREE') };
  const authMock = { isLoggedIn: vi.fn(), userRole: vi.fn() };

  function runGuard(routeData: Record<string, unknown>): unknown {
    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
    try {
      return runInInjectionContext(injector, () =>
        prescriptionAccessGuard(
          { data: routeData } as unknown as ActivatedRouteSnapshot,
          { url: '/recetas' } as never,
        ),
      );
    } finally {
      injector.destroy();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isLoggedIn.mockReturnValue(true);
    authMock.userRole.mockReturnValue('doctor');
  });

  it('redirige a /login si no hay sesión', () => {
    authMock.isLoggedIn.mockReturnValue(false);
    const result = runGuard({});
    expect(result).toBe('TREE');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/recetas' },
    });
  });

  it('permite a cualquier rol autenticado si no se exigen roles', () => {
    authMock.userRole.mockReturnValue('paciente');
    expect(runGuard({})).toBe(true);
  });

  it('permite a doctor cuando emitir exige solo doctor', () => {
    authMock.userRole.mockReturnValue('doctor');
    expect(runGuard({ roles: ['doctor'] })).toBe(true);
  });

  it('bloquea a admin y paciente en ruta de emisión exclusiva del médico', () => {
    authMock.userRole.mockReturnValue('admin');
    expect(runGuard({ roles: ['doctor'] })).toBe('TREE');
    authMock.userRole.mockReturnValue('paciente');
    expect(runGuard({ roles: ['doctor'] })).toBe('TREE');
    authMock.userRole.mockReturnValue('unknown');
    expect(runGuard({ roles: ['doctor'] })).toBe('TREE');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
