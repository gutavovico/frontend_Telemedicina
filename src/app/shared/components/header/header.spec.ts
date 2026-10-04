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
import { TenantService } from '../../../core/services/tenant.service';
import type { AppRole } from '../../../core/models/auth.models';
import { Header } from './header';

describe('Header entrada Recetas (CU16 hallazgo 4)', () => {
  const routerMock = { url: '/', navigate: vi.fn() };
  let isAuthenticated: WritableSignal<boolean>;
  let userRole: WritableSignal<AppRole>;
  let isSuperAdmin: WritableSignal<boolean>;
  let injector: DestroyableInjector;

  function create(): Header {
    const authMock = {
      isAuthenticated,
      userRole,
      isAdmin: () => userRole() === 'admin',
      isDoctor: () => userRole() === 'doctor',
      isPaciente: () => userRole() === 'paciente',
      isRecepcion: () => userRole() === 'recepcion',
    };
    const tenantMock = {
      isSuperAdmin,
      currentTenant: signal(null),
      clinicaNombre: signal('Telemedicina'),
    };
    injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authMock },
        { provide: TenantService, useValue: tenantMock },
      ],
    });
    return runInInjectionContext(injector, () => new Header());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    routerMock.url = '/';
    isAuthenticated = signal(true);
    userRole = signal<AppRole>('doctor');
    isSuperAdmin = signal(false);
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

  it('recepción va a su panel desde Perfil y no ve Panel admin', () => {
    userRole.set('recepcion');
    const header = create();
    header.goToProfile();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/admin/agenda']);
    expect(header.canSeeAdminPanel()).toBe(false);
    injector.destroy();
  });

  it('Panel Recepción navega a /admin/agenda y cierra menús', () => {
    userRole.set('recepcion');
    const header = create();
    header.isDropdownOpen.set(true);
    header.isMobileMenuOpen.set(true);
    header.goToRecepcionPanel();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/admin/agenda']);
    expect(header.isDropdownOpen()).toBe(false);
    expect(header.isMobileMenuOpen()).toBe(false);
    injector.destroy();
  });

  it('Panel Médico navega a /admin/agenda y cierra menús', () => {
    userRole.set('doctor');
    const header = create();
    header.isDropdownOpen.set(true);
    header.isMobileMenuOpen.set(true);
    header.goToMedicoPanel();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/admin/agenda']);
    expect(header.isDropdownOpen()).toBe(false);
    expect(header.isMobileMenuOpen()).toBe(false);
    injector.destroy();
  });

  it('gestión visible para admin, doctor y recepción; oculta para paciente y desconocido', () => {
    for (const rol of ['admin', 'doctor', 'recepcion'] as AppRole[]) {
      userRole.set(rol);
      const header = create();
      expect(header.canSeeGestion()).toBe(true);
      injector.destroy();
    }
    for (const rol of ['paciente', 'unknown'] as AppRole[]) {
      userRole.set(rol);
      const header = create();
      expect(header.canSeeGestion()).toBe(false);
      injector.destroy();
    }
    userRole.set('recepcion');
    isAuthenticated.set(false);
    expect(create().canSeeGestion()).toBe(false);
    injector.destroy();
  });

  it('oculta el header global dentro de /admin (manda el topbar del layout)', () => {
    routerMock.url = '/admin/usuarios';
    expect(create().isAdminRoute()).toBe(true);
    injector.destroy();
    routerMock.url = '/usuarios';
    expect(create().isAdminRoute()).toBe(false);
    injector.destroy();
  });
});
