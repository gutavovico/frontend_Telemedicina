import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  type DestroyableInjector,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AuthService } from './auth.service';
import { InactivityService } from './inactivity.service';
import { normalizeAppRole, type AppRole, type UsuarioResponse } from '../models/auth.models';
import type { MedicoResponse } from '../models/medico.models';

function makeUser(overrides: Partial<UsuarioResponse> = {}): UsuarioResponse {
  // Respuesta idéntica al contrato real de GET /auth/me (contrato oficial
  // backend `UsuarioResponse`): incluye id_rol por compatibilidad y `rol`
  // como nombre real de la relación Usuario.rol. Los tests nunca infieren
  // permisos desde id_rol, correo o nombre.
  return {
    id_usuario: 5,
    id_clinica: 1,
    tenant_id: '1',
    id_rol: 73,
    rol: 'PACIENTE',
    nombres: 'Juan',
    apellidos: 'Pérez',
    correo: 'juan.perez@clinica.bo',
    telefono: null,
    foto_perfil: null,
    estado: 'activo',
    notificaciones_push: true,
    notificaciones_email: true,
    notificaciones_sms: false,
    fecha_creacion: '2026-08-24T10:00:00Z',
    ...overrides,
  };
}

function makePerfilMedico(idMedico: number): MedicoResponse {
  return {
    id_medico: idMedico,
    id_usuario: 7,
    matricula_profesional: 'MAT-00007',
    estado: 'activo',
    fecha_registro: '2026-01-01',
    especialidades: [],
  };
}

describe('normalizeAppRole (CU16 hallazgo 1)', () => {
  it('mapea variantes de administrador', () => {
    expect(normalizeAppRole('ADMIN')).toBe('admin');
    expect(normalizeAppRole('administrador')).toBe('admin');
    expect(normalizeAppRole('  ADMINISTRACIÓN  ')).toBe('admin');
  });

  it('mapea variantes de médico con acentos y espacios', () => {
    expect(normalizeAppRole('MEDICO')).toBe('doctor');
    expect(normalizeAppRole('  médico ')).toBe('doctor');
    expect(normalizeAppRole('MÉDICO')).toBe('doctor');
    expect(normalizeAppRole('doctor')).toBe('doctor');
    expect(normalizeAppRole('Paciente')).toBe('paciente');
  });

  it('rol ausente o desconocido nunca eleva privilegios', () => {
    expect(normalizeAppRole(null)).toBe('unknown');
    expect(normalizeAppRole(undefined)).toBe('unknown');
    expect(normalizeAppRole('')).toBe('unknown');
    expect(normalizeAppRole('   ')).toBe('unknown');
    expect(normalizeAppRole('SUPERUSER')).toBe('unknown');
    expect(normalizeAppRole('root')).toBe('unknown');
  });
});

describe('AuthService.userRole sin heurísticas (CU16 hallazgo 1)', () => {
  const httpMock = { get: vi.fn(() => of(null)), post: vi.fn(() => of(null)) };
  const routerMock = { navigate: vi.fn() };
  const inactivityMock = {
    start: vi.fn(),
    stop: vi.fn(),
    expired$: new Subject<void>(),
  };
  let injector: DestroyableInjector;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    injector = Injector.create({
      providers: [
        { provide: HttpClient, useValue: httpMock },
        { provide: Router, useValue: routerMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: InactivityService, useValue: inactivityMock },
      ],
    });
    service = runInInjectionContext(injector, () => new AuthService());
  });

  afterEach(() => {
    injector.destroy();
    window.localStorage.clear();
  });

  function setContext(user: UsuarioResponse | null, perfil: MedicoResponse | null): void {
    service.currentUser.set(user);
    service.perfilMedico.set(perfil);
  }

  it('ADMIN real con correo y nombre normales es admin', () => {
    // Contrato real: id_rol no habitual (91) + rol oficial ADMIN.
    setContext(
      makeUser({
        id_usuario: 11,
        id_clinica: 1,
        tenant_id: '1',
        id_rol: 91,
        correo: 'juan.perez@clinica.bo',
        nombres: 'Juan',
        rol: 'ADMIN',
        estado: 'activo',
        fecha_creacion: '2026-08-24T10:00:00Z',
      }),
      null,
    );
    expect(service.userRole()).toBe('admin');
    expect(service.isAdmin()).toBe(true);
    expect(service.isDoctor()).toBe(false);
  });

  it('MEDICO real con correo sin la palabra doctor es doctor', () => {
    setContext(
      makeUser({
        id_usuario: 12,
        id_rol: 52,
        correo: 'carlos.mendoza@salud.bo',
        nombres: 'Carlos',
        rol: 'MEDICO',
        estado: 'activo',
      }),
      null,
    );
    expect(service.userRole()).toBe('doctor');
    expect(service.isDoctor()).toBe(true);
    expect(service.isAdmin()).toBe(false);
  });

  it('PACIENTE cuyo correo contiene "doctor" sigue siendo paciente', () => {
    setContext(
      makeUser({
        id_usuario: 13,
        id_rol: 73,
        correo: 'doctor.fan@gmail.com',
        nombres: 'Ana Doctora',
        rol: 'PACIENTE',
      }),
      null,
    );
    const rol: AppRole = service.userRole();
    expect(rol).toBe('paciente');
    expect(service.isDoctor()).toBe(false);
    expect(service.isAdmin()).toBe(false);
  });

  it('usuario con ID 1 que no es ADMIN no recibe privilegios', () => {
    // id_rol == 1 sin nombre ADMIN real: ningún ID mágico concede privilegios.
    setContext(makeUser({ id_usuario: 1, id_rol: 1, rol: 'PACIENTE' }), null);
    expect(service.userRole()).toBe('paciente');
    expect(service.isAdmin()).toBe(false);
  });

  it('correo o nombre con "admin" sin rol explícito no concede administración', () => {
    setContext(
      makeUser({
        correo: 'admin.fan@gmail.com',
        nombres: 'Admin Fan',
        id_rol: 73,
        rol: 'PACIENTE',
      }),
      null,
    );
    expect(service.userRole()).toBe('paciente');
    setContext(
      makeUser({
        correo: 'ana@gmail.com',
        nombres: 'Ana',
        id_usuario: 9,
        id_rol: null,
        rol: null,
      }),
      null,
    );
    expect(service.userRole()).toBe('unknown');
  });

  it('rol ausente o desconocido retorna unknown sin privilegios', () => {
    // id_rol presente pero sin `rol` oficial: fail-closed, sin privilegios.
    setContext(makeUser({ id_rol: 73, rol: undefined }), null);
    expect(service.userRole()).toBe('unknown');
    setContext(makeUser({ id_rol: 73, rol: null }), null);
    expect(service.userRole()).toBe('unknown');
    setContext(makeUser({ id_rol: 73, rol: 'SUPERUSER' }), null);
    expect(service.userRole()).toBe('unknown');
    expect(service.isAdmin()).toBe(false);
    expect(service.isDoctor()).toBe(false);
  });

  it('sin usuario autenticado el rol es unknown', () => {
    setContext(null, null);
    expect(service.userRole()).toBe('unknown');
    expect(service.isAdmin()).toBe(false);
    expect(service.isDoctor()).toBe(false);
  });

  it('perfil médico confirmado acredita doctor solo con rol ausente o desconocido', () => {
    setContext(makeUser({ id_rol: 52, rol: undefined }), makePerfilMedico(7));
    expect(service.userRole()).toBe('doctor');
  });

  it('perfil médico no convierte un ADMIN real en doctor', () => {
    setContext(makeUser({ id_rol: 91, rol: 'ADMINISTRADOR' }), makePerfilMedico(7));
    expect(service.userRole()).toBe('admin');
  });

  it('perfil médico no reemplaza un rol explícito incompatible (PACIENTE)', () => {
    setContext(makeUser({ id_rol: 73, rol: 'PACIENTE' }), makePerfilMedico(7));
    expect(service.userRole()).toBe('paciente');
  });
});
