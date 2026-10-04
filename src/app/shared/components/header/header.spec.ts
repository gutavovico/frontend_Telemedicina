import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Injector,
  runInInjectionContext,
  signal,
  type DestroyableInjector,
  type WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import type { AppRole } from '../../../core/models/auth.models';
import { Header } from './header';

describe('Header entrada Recetas (CU16 hallazgo 4)', () => {
  const routerMock = { url: '/', navigate: vi.fn() };
  let isAuthenticated: WritableSignal<boolean>;
  let userRole: WritableSignal<AppRole>;
  let injector: DestroyableInjector;

  function create(): Header {
    const authMock = {
      isAuthenticated,
      userRole,
      isAdmin: () => userRole() === 'admin',
      isDoctor: () => userRole() === 'doctor',
    };
    injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
    return runInInjectionContext(injector, () => new Header());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    routerMock.url = '/';
    isAuthenticated = signal(true);
    userRole = signal<AppRole>('doctor');
  });

  it('visible para admin, doctor y paciente reales', () => {
    for (const rol of ['admin', 'doctor', 'paciente'] as AppRole[]) {
      userRole.set(rol);
      const header = create();
      expect(header.canSeeRecetas()).toBe(true);
      injector.destroy();
    }
  });

  it('oculta para rol desconocido o sin sesión', () => {
    userRole.set('unknown');
    expect(create().canSeeRecetas()).toBe(false);
    injector.destroy();
    userRole.set('doctor');
    isAuthenticated.set(false);
    expect(create().canSeeRecetas()).toBe(false);
    injector.destroy();
  });

  it('detecta la sección de recetas y navega a ella', () => {
    const header = create();
    routerMock.url = '/recetas/emitir';
    expect(header.isRecetasRoute()).toBe(true);
    routerMock.url = '/consultas';
    expect(header.isRecetasRoute()).toBe(false);
    header.goToRecetas();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/recetas']);
    expect(header.isMobileMenuOpen()).toBe(false);
    injector.destroy();
  });
  it('navega a Productos y cierra los menus', () => {
    userRole.set('admin');
    const header = create();
    header.isDropdownOpen.set(true);
    header.isMobileMenuOpen.set(true);
    header.goToProducts();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/medicamentos']);
    expect(header.isDropdownOpen()).toBe(false);
    expect(header.isMobileMenuOpen()).toBe(false);
    injector.destroy();
  });
});
