import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../core/services/auth.service';
import { UsuarioResponse } from '../../../../core/models/auth.models';
import { reportsAccessGuard } from './reports-access.guard';

const admin = { rol: 'ADMIN', estado: 'ACTIVO', id_clinica: 12 } as UsuarioResponse;

describe('CU22 acceso a /analitica', () => {
  function setup(loggedIn: boolean, profile: Observable<UsuarioResponse | null>) {
    const loginTree = { redirect: 'login' };
    const homeTree = { redirect: 'home' };
    const router = {
      createUrlTree: vi.fn((path: string[]) => path[0] === '/login' ? loginTree : homeTree),
    };
    const auth = { isLoggedIn: () => loggedIn, fetchUserProfile: vi.fn(() => profile) };
    const injector: DestroyableInjector = Injector.create({ providers: [
      { provide: Router, useValue: router }, { provide: AuthService, useValue: auth },
    ] });
    const invoke = () => runInInjectionContext(injector, () => reportsAccessGuard(
      {} as ActivatedRouteSnapshot, { url: '/analitica' } as RouterStateSnapshot));
    return { invoke, injector, auth, router, loginTree, homeTree };
  }

  it('redirige a login sin sesión y conserva returnUrl', () => {
    const context = setup(false, of(null));
    expect(context.invoke()).toBe(context.loginTree);
    expect(context.auth.fetchUserProfile).not.toHaveBeenCalled();
    expect(context.router.createUrlTree).toHaveBeenCalledWith(['/login'],
      { queryParams: { returnUrl: '/analitica' } });
    context.injector.destroy();
  });

  it('espera perfil verificado para permitir administrador activo de clínica', () => {
    const profile = new Subject<UsuarioResponse | null>();
    const context = setup(true, profile);
    const received: unknown[] = [];
    const result = context.invoke();
    if (typeof result === 'object' && 'subscribe' in result) result.subscribe((value) => received.push(value));
    expect(received).toEqual([]);
    profile.next(admin);
    expect(received).toEqual([true]);
    context.injector.destroy();
  });

  it('rechaza otro rol, perfil inactivo, sin clínica y error de perfil', () => {
    for (const profile of [
      { ...admin, rol: 'MEDICO' }, { ...admin, estado: 'INACTIVO' },
      { ...admin, id_clinica: null }, null,
    ]) {
      const context = setup(true, of(profile as UsuarioResponse | null));
      const received: unknown[] = [];
      const result = context.invoke();
      if (typeof result === 'object' && 'subscribe' in result) result.subscribe((value) => received.push(value));
      expect(received).toEqual([context.homeTree]);
      context.injector.destroy();
    }
  });
});
