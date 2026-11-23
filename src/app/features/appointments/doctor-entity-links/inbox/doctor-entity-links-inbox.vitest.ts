import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { DoctorEntityLinkService } from '../../../../core/services/doctor-entity-link.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { DoctorEntityLinksInbox } from './doctor-entity-links-inbox';
import type { DoctorEntityLink } from '../../../../core/models/doctor-entity-link.models';

function link(estado: DoctorEntityLink['estado']): DoctorEntityLink {
  return {
    id_vinculacion: 1, id_usuario: 2, id_medico: 3, estado,
    nombres: 'Ada', apellidos: 'Lovelace', correo: 'ada@test.com', telefono: null,
    documento_identidad: null, matricula_profesional: 'M-1', existe_perfil: true,
    roles: [{ id_rol: 2, nombre: 'Médico', es_principal: true }], especialidades: [],
    sedes: [], fecha_invitacion: '2026-01-01', respondido_en: null, fecha_estado: '2026-01-01',
    motivo_estado: null, row_version: 0,
  };
}

describe('CU29 bandeja médica', () => {
  function setup(
    service: Partial<DoctorEntityLinkService>,
    tenantService?: Partial<TenantService>,
  ): DoctorEntityLinksInbox {
    TestBed.configureTestingModule({
      providers: [
        DoctorEntityLinksInbox,
        { provide: DoctorEntityLinkService, useValue: service },
        { provide: TenantService, useValue: tenantService ?? {
          selectedTenantId: signal<number | null>(null),
          setSelectedTenant: vi.fn(),
          loadTenantContext: vi.fn(() => of(null)),
          clearTenant: vi.fn(),
        } },
      ],
    });
    const component = TestBed.inject(DoctorEntityLinksInbox);
    component.ngOnInit();
    return component;
  }

  it('carga invitaciones y acepta una invitación', () => {
    const service = {
      listarMisVinculaciones: vi.fn(() => of({ total: 1, page: 1, per_page: 20, items: [link('INVITADO')] })),
      listarMisEntidades: vi.fn(() => of({ items: [] })),
      aceptarInvitacion: vi.fn(() => of(link('ACTIVO'))),
      rechazarInvitacion: vi.fn(),
    };
    const tenantService = {
      selectedTenantId: signal<number | null>(null),
      setSelectedTenant: vi.fn(),
      loadTenantContext: vi.fn(() => of(null)),
      clearTenant: vi.fn(),
    };
    const component = setup(service, tenantService);
    expect(component.links()[0].estado).toBe('INVITADO');
    component.accept(component.links()[0]);
    expect(service.aceptarInvitacion).toHaveBeenCalledWith(1);
    expect(component.links()[0].estado).toBe('ACTIVO');
    expect(component.successMessage()).toContain('aceptada');
    expect(tenantService.loadTenantContext).toHaveBeenCalled();
  });

  it('carga las entidades con vínculo activo para el selector', () => {
    const service = {
      listarMisVinculaciones: vi.fn(() => of({ total: 0, page: 1, per_page: 20, items: [] })),
      listarMisEntidades: vi.fn(() => of({ items: [{ id_clinica: 7, nombre: 'Clínica Siete' }, { id_clinica: 9, nombre: 'Clínica Nueve' }] })),
      aceptarInvitacion: vi.fn(),
      rechazarInvitacion: vi.fn(),
    };
    const component = setup(service);
    expect(component.availableClinics()).toHaveLength(2);
  });

  it('actualiza la entidad seleccionada y valida el contexto', () => {
    const selectedTenantId = signal<number | null>(null);
    const tenantService = {
      selectedTenantId,
      setSelectedTenant: vi.fn((id: number | null) => selectedTenantId.set(id)),
      loadTenantContext: vi.fn(() => of({
        clinica_id: 9,
        clinica_nombre: 'Clínica Nueve',
        clinica_estado: 'ACTIVO',
        usuario_id: 7,
        usuario_nombres: 'Ada',
        usuario_apellidos: 'Lovelace',
        usuario_correo: 'ada@test.com',
        rol: 'MEDICO',
        permisos: [],
        es_super_admin: false,
      })),
      clearTenant: vi.fn(() => selectedTenantId.set(null)),
    };
    const service = {
      listarMisVinculaciones: vi.fn(() => of({ total: 0, page: 1, per_page: 20, items: [] })),
      listarMisEntidades: vi.fn(() => of({ items: [{ id_clinica: 7, nombre: 'Clínica Siete' }, { id_clinica: 9, nombre: 'Clínica Nueve' }] })),
      aceptarInvitacion: vi.fn(),
      rechazarInvitacion: vi.fn(),
    };
    const component = setup(service, tenantService);
    component.selectClinic({ target: { value: '9' } } as unknown as Event);
    expect(tenantService.setSelectedTenant).toHaveBeenCalledWith(9);
    expect(tenantService.loadTenantContext).toHaveBeenCalled();
    expect(component.selectedClinicId()).toBe(9);
  });

  it('limpia una entidad seleccionada que ya no está disponible', () => {
    const selectedTenantId = signal<number | null>(7);
    const tenantService = {
      selectedTenantId,
      setSelectedTenant: vi.fn((id: number | null) => selectedTenantId.set(id)),
      loadTenantContext: vi.fn(() => of(null)),
      clearTenant: vi.fn(),
    };
    const service = {
      listarMisVinculaciones: vi.fn(() => of({ total: 0, page: 1, per_page: 20, items: [] })),
      listarMisEntidades: vi.fn(() => of({ items: [{ id_clinica: 9, nombre: 'Clínica Nueve' }] })),
      aceptarInvitacion: vi.fn(),
      rechazarInvitacion: vi.fn(),
    };
    const component = setup(service, tenantService);
    expect(tenantService.setSelectedTenant).toHaveBeenCalledWith(null);
    expect(component.selectedClinicId()).toBeNull();
  });

  it('exige motivo para rechazar', () => {
    const service = {
      listarMisVinculaciones: vi.fn(() => of({ total: 1, page: 1, per_page: 20, items: [link('INVITADO')] })),
      listarMisEntidades: vi.fn(() => of({ items: [] })),
      aceptarInvitacion: vi.fn(),
      rechazarInvitacion: vi.fn(() => of(link('RECHAZADO'))),
    };
    const component = setup(service);
    component.openReject(component.links()[0]);
    component.reject();
    expect(service.rechazarInvitacion).not.toHaveBeenCalled();
  });

  it('informa un 409 sin reintentar automáticamente', () => {
    const service = {
      listarMisVinculaciones: vi.fn(() => of({ total: 1, page: 1, per_page: 20, items: [link('INVITADO')] })),
      listarMisEntidades: vi.fn(() => of({ items: [] })),
      aceptarInvitacion: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409 }))),
      rechazarInvitacion: vi.fn(),
    };
    const component = setup(service);
    component.accept(component.links()[0]);
    expect(service.aceptarInvitacion).toHaveBeenCalledTimes(1);
    expect(component.errorMessage()).toContain('respondida');
  });
});
