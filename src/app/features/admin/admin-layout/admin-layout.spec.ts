import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { AdminLayout } from './admin-layout';

describe('AdminLayout navegación CU05/CU22', () => {
  it('solo habilita Reportes para ADMIN verificado de una clínica activa', () => {
    const currentUser = signal({ rol: 'ADMIN', estado: 'ACTIVO', id_clinica: 2 });
    const isAuthenticated = signal(true);
    const profileVerified = signal(true);
    const injector = Injector.create({ providers: [
      { provide: AuthService, useValue: { currentUser, isAuthenticated, profileVerified } },
      { provide: TenantService, useValue: {} },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ] });
    const layout = runInInjectionContext(injector, () => new AdminLayout());
    expect(layout.canSeeReports()).toBe(true);
    currentUser.set({ rol: 'MÉDICO', estado: 'ACTIVO', id_clinica: 2 });
    expect(layout.canSeeReports()).toBe(false);
    currentUser.set({ rol: 'ADMIN', estado: 'ACTIVO', id_clinica: 2 });
    profileVerified.set(false);
    expect(layout.canSeeReports()).toBe(false);
    profileVerified.set(true);
    isAuthenticated.set(false);
    expect(layout.canSeeReports()).toBe(false);
    injector.destroy();
  });
});
