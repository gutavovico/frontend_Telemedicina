import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { treatmentAccessGuard } from './treatment-access.guard';

describe('treatmentAccessGuard (CU17)', () => {
  let injector: DestroyableInjector;
  let authServiceMock: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    getUserRole: ReturnType<typeof vi.fn>;
  };
  let routerMock: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  const fakeState: RouterStateSnapshot = {
    url: '/tratamientos',
    root: {} as any,
  };

  function executeGuard(route: Partial<ActivatedRouteSnapshot>): any {
    return runInInjectionContext(injector, () =>
      treatmentAccessGuard(route as ActivatedRouteSnapshot, fakeState)
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authServiceMock = {
      isLoggedIn: vi.fn(() => true),
      getUserRole: vi.fn(() => 'doctor'),
    };
    routerMock = {
      createUrlTree: vi.fn((commands: any[], extras?: any) => {
        return { commands, extras } as unknown as UrlTree;
      }),
    };

    injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('redirige a /login con returnUrl si no está autenticado', () => {
    authServiceMock.isLoggedIn.mockReturnValue(false);

    const result = executeGuard({ data: {} });

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/tratamientos' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        commands: ['/login'],
        extras: { queryParams: { returnUrl: '/tratamientos' } },
      })
    );
  });

  it('permite acceso por defecto al rol doctor', () => {
    authServiceMock.getUserRole.mockReturnValue('doctor');
    const result = executeGuard({ data: {} });
    expect(result).toBe(true);
  });

  it('permite acceso por defecto al rol paciente', () => {
    authServiceMock.getUserRole.mockReturnValue('paciente');
    const result = executeGuard({ data: {} });
    expect(result).toBe(true);
  });

  it('deniega acceso y redirige a / al rol admin (contrato CU17 restringe a médico y paciente)', () => {
    authServiceMock.getUserRole.mockReturnValue('admin');
    const result = executeGuard({ data: {} });

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toEqual(expect.objectContaining({ commands: ['/'] }));
  });

  it('deniega acceso y redirige a / al rol recepcion', () => {
    authServiceMock.getUserRole.mockReturnValue('recepcion');
    const result = executeGuard({ data: {} });

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toEqual(expect.objectContaining({ commands: ['/'] }));
  });

  it('respeta roles específicos en route.data (ej. solo doctor en crear)', () => {
    const routeConRoles = { data: { roles: ['doctor'] } };

    // Médico: permitido
    authServiceMock.getUserRole.mockReturnValue('doctor');
    expect(executeGuard(routeConRoles)).toBe(true);

    // Paciente: denegado
    authServiceMock.getUserRole.mockReturnValue('paciente');
    const resPaciente = executeGuard(routeConRoles);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(resPaciente).toEqual(expect.objectContaining({ commands: ['/'] }));

    // Admin: denegado
    authServiceMock.getUserRole.mockReturnValue('admin');
    const resAdmin = executeGuard(routeConRoles);
    expect(resAdmin).toEqual(expect.objectContaining({ commands: ['/'] }));
  });
});
