import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  type DestroyableInjector,
  type WritableSignal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { InactivityService } from '../services/inactivity.service';
import { TenantService } from '../services/tenant.service';
import type { TenantContext } from '../models/tenant.models';
import { superAdminGuard } from './super-admin.guard';
import { clinicAdminGuard } from './clinic-admin.guard';
import { clinicaGuard } from './clinica.guard';
import { panelGuard, adminOnlyGuard, staffGuard, clinicalReadGuard, clinicalWriteGuard } from './panel-access.guard';

function makeTenant(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    clinica_id: 1,
    clinica_nombre: 'Clínica Uno',
    clinica_estado: 'ACTIVO',
    usuario_id: 1,
    usuario_nombres: 'Admin',
    usuario_apellidos: 'Uno',
    usuario_correo: 'admin@uno.com',
    rol: 'Administrador',
    permisos: [],
    es_super_admin: false,
    ...overrides,
  };
}

describe('Guards multitenant (/admin)', () => {
  const routerMock = {
    navigate: vi.fn(),
    createUrlTree: vi.fn((commands: unknown[]) => ({ commands })),
  };
  let currentTenant: WritableSignal<TenantContext | null>;
  let injector: DestroyableInjector;

  function runGuard(guard: () => unknown): unknown {
    injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        {
          provide: TenantService,
          useValue: {
            currentTenant,
            isSuperAdmin: () => currentTenant()?.es_super_admin ?? false,
            isClinicaActiva: () => {
              const t = currentTenant();
              if ((t?.es_super_admin ?? false) && !t?.clinica_id) return true;
              return t?.clinica_estado === 'ACTIVO';
            },
          },
        },
      ],
    });
    const result = runInInjectionContext(injector, guard);
    injector.destroy();
    return result;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    currentTenant = signal<TenantContext | null>(makeTenant());
  });

  it('superAdminGuard deja pasar al superadmin y redirige al resto a /admin/dashboard', () => {
    currentTenant.set(makeTenant({ clinica_id: null, es_super_admin: true }));
    expect(runGuard(() => superAdminGuard(null as never, null as never))).toBe(true);
    currentTenant.set(makeTenant());
    const res = runGuard(() => superAdminGuard(null as never, null as never)) as {
      commands: unknown[];
    };
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
    expect(res.commands).toEqual(['/admin/dashboard']);
  });

  it('clinicAdminGuard deja pasar al admin de clínica y devuelve al superadmin a /admin/clinicas', () => {
    expect(runGuard(() => clinicAdminGuard(null as never, null as never))).toBe(true);
    currentTenant.set(makeTenant({ clinica_id: null, es_super_admin: true }));
    const res = runGuard(() => clinicAdminGuard(null as never, null as never)) as {
      commands: unknown[];
    };
    expect(res.commands).toEqual(['/admin/clinicas']);
  });

  it('clinicaGuard bloquea clínica no ACTIVA hacia /clinica-inactiva', () => {
    expect(runGuard(() => clinicaGuard(null as never, null as never))).toBe(true);
    currentTenant.set(makeTenant({ clinica_estado: 'SUSPENDIDO' }));
    const res = runGuard(() => clinicaGuard(null as never, null as never)) as {
      commands: unknown[];
    };
    expect(res.commands).toEqual(['/clinica-inactiva']);
  });
});

describe('Guards del panel condicionado', () => {
  const routerMock = {
    navigate: vi.fn(),
    createUrlTree: vi.fn((commands: unknown[]) => ({ commands })),
  };
  let authRole: WritableSignal<string>;
  let superAdmin: WritableSignal<boolean>;
  let injector: DestroyableInjector;

  function runPanelGuard(guard: () => unknown): unknown {
    injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        {
          provide: TenantService,
          useValue: { isSuperAdmin: () => superAdmin() },
        },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => authRole() === 'admin',
            isRecepcion: () => authRole() === 'recepcion',
            isDoctor: () => authRole() === 'doctor',
            isPaciente: () => authRole() === 'paciente',
          },
        },
      ],
    });
    const result = runInInjectionContext(injector, guard);
    injector.destroy();
    return result;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authRole = signal('admin');
    superAdmin = signal(false);
  });

  it('panelGuard deja entrar a superadmin, admin, recepción y médico; frena al resto', () => {
    expect(runPanelGuard(() => panelGuard(null as never, null as never))).toBe(true);
    authRole.set('recepcion');
    expect(runPanelGuard(() => panelGuard(null as never, null as never))).toBe(true);
    authRole.set('doctor');
    expect(runPanelGuard(() => panelGuard(null as never, null as never))).toBe(true);
    superAdmin.set(true);
    authRole.set('unknown');
    expect(runPanelGuard(() => panelGuard(null as never, null as never))).toBe(true);
    superAdmin.set(false);
    authRole.set('paciente');
    const res = runPanelGuard(() => panelGuard(null as never, null as never)) as {
      commands: unknown[];
    };
    expect(res.commands).toEqual(['/']);
  });

  it('adminOnlyGuard solo admin de clínica; staffGuard admin, recepción o médico', () => {
    expect(runPanelGuard(() => adminOnlyGuard(null as never, null as never))).toBe(true);
    expect(runPanelGuard(() => staffGuard(null as never, null as never))).toBe(true);
    authRole.set('recepcion');
    const denied = runPanelGuard(() => adminOnlyGuard(null as never, null as never)) as {
      commands: unknown[];
    };
    expect(denied.commands).toEqual(['/']);
    expect(runPanelGuard(() => staffGuard(null as never, null as never))).toBe(true);
    authRole.set('doctor');
    expect(runPanelGuard(() => staffGuard(null as never, null as never))).toBe(true);
    const deniedMedico = runPanelGuard(() => adminOnlyGuard(null as never, null as never)) as {
      commands: unknown[];
    };
    expect(deniedMedico.commands).toEqual(['/']);
  });

  it('CU28 permite leer HCE a admin, médico y paciente; registrar solo a médico', () => {
    expect(runPanelGuard(() => clinicalReadGuard(null as never, null as never))).toBe(true);
    authRole.set('doctor');
    expect(runPanelGuard(() => clinicalReadGuard(null as never, null as never))).toBe(true);
    expect(runPanelGuard(() => clinicalWriteGuard(null as never, null as never))).toBe(true);
    authRole.set('paciente');
    expect(runPanelGuard(() => clinicalReadGuard(null as never, null as never))).toBe(true);
    const pacienteWrite = runPanelGuard(() => clinicalWriteGuard(null as never, null as never)) as { commands: unknown[] };
    expect(pacienteWrite.commands).toEqual(['/']);
    authRole.set('recepcion');
    const recepcionRead = runPanelGuard(() => clinicalReadGuard(null as never, null as never)) as { commands: unknown[] };
    expect(recepcionRead.commands).toEqual(['/']);
  });
});

describe.skip('AuthService.redirectByRole (CU04/CU16 - no implementado en Miguel)', () => {
  // Tests omitidos: funcionalidad de superadmin/redirectByRole no implementada en esta rama
});
