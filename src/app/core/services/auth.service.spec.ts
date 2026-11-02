import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  type DestroyableInjector,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { InactivityService } from './inactivity.service';
import { TenantService } from './tenant.service';
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
  const httpMock = {
    get: vi.fn((..._args: unknown[]): Observable<unknown> => of(null)),
    post: vi.fn(() => of(null)),
  };
  const routerMock = { navigate: vi.fn() };
  const inactivityMock = {
    start: vi.fn(),
    stop: vi.fn(),
    expired$: new Subject<void>(),
  };
  const tenantMock = {
    currentTenant: signal(null),
    isSuperAdmin: signal(false),
    permisos: signal([] as string[]),
    loadTenantContext: vi.fn(() => of(null)),
    clearTenant: vi.fn(),
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
        { provide: TenantService, useValue: tenantMock },
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

  it('RECEPCION se reconoce sin conceder privilegios de gestión', () => {
    setContext(
      makeUser({
        id_usuario: 14,
        id_rol: 3,
        correo: 'recep@clinica.bo',
        nombres: 'Patricia',
        rol: 'RECEPCION',
      }),
      null,
    );
    expect(service.userRole()).toBe('recepcion');
    expect(service.isRecepcion()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.isDoctor()).toBe(false);
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

  it('rol ausente o desconocido retorna unknown sin privilegios', () => {    // id_rol presente pero sin `rol` oficial: fail-closed, sin privilegios.
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

  it('perfil médico no concede permisos si el rol de la sesión falta', () => {
    setContext(makeUser({ id_rol: 52, rol: undefined }), makePerfilMedico(7));
    expect(service.userRole()).toBe('unknown');
    expect(service.isDoctor()).toBe(false);
  });

  it('perfil médico no convierte un ADMIN real en doctor', () => {
    setContext(makeUser({ id_rol: 91, rol: 'ADMINISTRADOR' }), makePerfilMedico(7));
    expect(service.userRole()).toBe('admin');
  });

  it('perfil médico no reemplaza un rol explícito incompatible (PACIENTE)', () => {
    setContext(makeUser({ id_rol: 73, rol: 'PACIENTE' }), makePerfilMedico(7));
    expect(service.userRole()).toBe('paciente');
  });

  it('verifica perfil fresco y limpia acceso del Header al cerrar sesión', () => {
    service.saveTokens('token-sintetico', 'refresh-sintetico');
    httpMock.get.mockReturnValueOnce(of(makeUser({ rol: 'Administración', id_clinica: 1 })));
    service.fetchUserProfile().subscribe();
    expect(service.profileVerified()).toBe(true);
    expect(service.userRole()).toBe('admin');
    httpMock.post.mockReturnValueOnce(of(null));
    service.logout();
    expect(service.profileVerified()).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('no confirma un perfil si ambos endpoints fallan', () => {
    service.saveTokens('token-sintetico', 'refresh-sintetico');
    httpMock.get.mockReturnValueOnce(throwError(() => new Error('auth/me')))
      .mockReturnValueOnce(throwError(() => new Error('usuarios/me')));
    let profile: UsuarioResponse | null = makeUser();
    service.fetchUserProfile().subscribe((user) => profile = user);
    expect(profile).toBeNull();
    expect(service.profileVerified()).toBe(false);
  });

  describe('Purga de datos clínicos de CU17 en salida de sesión (CU17 / CU23)', () => {
    beforeEach(() => {
      window.sessionStorage?.clear();
      window.localStorage?.clear();
    });

    afterEach(() => {
      window.sessionStorage?.clear();
      window.localStorage?.clear();
    });

    it('1. cierre de sesión normal (logout) elimina payload clínico, nota y hora del almacenamiento', () => {
      service.saveTokens('token-test', 'refresh-test');
      sessionStorage.setItem(
        'pending_dose_42_1_101',
        JSON.stringify({
          id_dosis: 101,
          id_tratamiento: 15,
          idempotency_key: 'idem-key-1',
          payload: { estado: 'INGERIDA', nota: 'Tomada con jugo de naranja', efectiva_en: '2026-10-30T08:00:00Z' },
          raw_hora_efectiva: '08:00',
        })
      );
      sessionStorage.setItem(
        'cu17_recovery_42_1_101',
        JSON.stringify({
          id_dosis: 101,
          id_tratamiento: 15,
          idempotency_key: 'idem-key-1',
          timestamp: 1730000000000,
          id_usuario: 42,
          id_clinica: 1,
        })
      );
      localStorage.setItem('cu17_cache_nota', JSON.stringify({ nota: 'Cefalea leve post ingesta' }));

      httpMock.post.mockReturnValueOnce(of(null));
      service.logout();

      expect(sessionStorage.getItem('pending_dose_42_1_101')).toBeNull();
      expect(localStorage.getItem('cu17_cache_nota')).toBeNull();

      const markerRaw = sessionStorage.getItem('cu17_recovery_42_1_101');
      expect(markerRaw).not.toBeNull();
      const marker = JSON.parse(markerRaw!);
      expect(marker.id_dosis).toBe(101);
      expect(marker.idempotency_key).toBe('idem-key-1');
      expect(marker.payload).toBeUndefined();
      expect(marker.nota).toBeUndefined();
      expect(marker.efectiva_en).toBeUndefined();
    });

    it('2. cierre por inactividad (onInactivityExpired y onSessionClosedByInactivity) purga datos clínicos', () => {
      sessionStorage.setItem(
        'pending_dose_42_1_102',
        JSON.stringify({
          id_dosis: 102,
          payload: { estado: 'INGERIDA', nota: 'Nota confidencial', efectiva_en: '2026-10-30T12:00:00Z' },
        })
      );
      localStorage.setItem('local_clinical_note', JSON.stringify({ nota: 'Síntomas gástricos' }));

      service.onSessionClosedByInactivity();

      expect(sessionStorage.getItem('pending_dose_42_1_102')).toBeNull();
      expect(localStorage.getItem('local_clinical_note')).toBeNull();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { inactive: 'true' } });
    });

    it('3. cierre de sesión remota (logoutRemoto) purga datos clínicos del almacenamiento', () => {
      service.saveTokens('token-remoto', 'refresh-remoto');
      sessionStorage.setItem(
        'pending_dose_42_1_103',
        JSON.stringify({
          id_dosis: 103,
          payload: { estado: 'OMITIDA', nota: 'Omitida por nauseas' },
        })
      );

      httpMock.post.mockReturnValueOnce(of(null));
      service.logoutRemoto();

      expect(sessionStorage.getItem('pending_dose_42_1_103')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('4. ausencia absoluta de nota, hora clínica y payload legible en sessionStorage y localStorage tras salir', () => {
      sessionStorage.setItem('pending_dose_42_1_104', JSON.stringify({ payload: { nota: 'Dosis doble', efectiva_en: '2026-10-30T15:00:00Z' } }));
      sessionStorage.setItem('temp_clinical_data', JSON.stringify({ raw_hora_efectiva: '15:00', indicaciones: 'Tomar con leche' }));
      localStorage.setItem('extra_med_info', JSON.stringify({ medicamento_nombre: 'Amoxicilina 500mg' }));

      service.clearTokens();

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)!;
        const val = sessionStorage.getItem(key) || '';
        expect(key.startsWith('pending_dose_')).toBe(false);
        expect(val.toLowerCase()).not.toContain('"nota"');
        expect(val.toLowerCase()).not.toContain('"efectiva_en"');
        expect(val.toLowerCase()).not.toContain('"raw_hora_efectiva"');
        expect(val.toLowerCase()).not.toContain('"medicamento_nombre"');
        expect(val.toLowerCase()).not.toContain('amoxicilina');
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        const val = localStorage.getItem(key) || '';
        expect(key.startsWith('pending_dose_')).toBe(false);
        expect(val.toLowerCase()).not.toContain('"nota"');
        expect(val.toLowerCase()).not.toContain('"efectiva_en"');
        expect(val.toLowerCase()).not.toContain('"medicamento_nombre"');
        expect(val.toLowerCase()).not.toContain('amoxicilina');
      }
    });
  });
});
