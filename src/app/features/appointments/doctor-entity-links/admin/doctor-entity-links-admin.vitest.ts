import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { DoctorEntityLinkService } from '../../../../core/services/doctor-entity-link.service';
import { RolesService } from '../../../../core/services/roles.service';
import { MedicoService } from '../../../../core/services/medico.service';
import { ConfigurationService } from '../../../tenants/entity-configuration/services/configuration.service';
import { DoctorEntityLinksAdmin } from './doctor-entity-links-admin';
import type { DoctorEntityLink } from '../../../../core/models/doctor-entity-link.models';

function link(estado: DoctorEntityLink['estado'] = 'ACTIVO'): DoctorEntityLink {
  return {
    id_vinculacion: 1, id_usuario: 2, id_medico: 3, estado,
    nombres: 'Ada', apellidos: 'Lovelace', correo: 'ada@test.com', telefono: null,
    documento_identidad: null, matricula_profesional: 'M-1', existe_perfil: true,
    roles: [{ id_rol: 2, nombre: 'Médico', es_principal: true }], especialidades: [],
    sedes: [], fecha_invitacion: '2026-01-01', respondido_en: null, fecha_estado: '2026-01-01',
    motivo_estado: null, row_version: 3,
  };
}

describe('CU29 administración de vínculos', () => {
  function setup(overrides: Partial<DoctorEntityLinkService> = {}) {
    const service = {
      listarVinculaciones: vi.fn(() => of({ total: 1, page: 1, per_page: 20, items: [link()] })),
      buscarCandidato: vi.fn(),
      crearVinculacion: vi.fn(),
      obtenerDetalle: vi.fn(() => of({ vinculacion: link(), historial: [] })),
      reemplazarAsignaciones: vi.fn(() => of(link())),
      cambiarEstado: vi.fn(() => of(link('SUSPENDIDO'))),
      ...overrides,
    };
    TestBed.configureTestingModule({
      providers: [
        DoctorEntityLinksAdmin,
        { provide: DoctorEntityLinkService, useValue: service },
        { provide: RolesService, useValue: { getRoles: vi.fn(() => of([{ id_rol: 2, nombre: 'Médico', estado: 'ACTIVO' }])) } },
        { provide: MedicoService, useValue: { listarEspecialidades: vi.fn(() => of([])) } },
        {
          provide: ConfigurationService,
          useValue: {
            leer: vi.fn(() => of({
              identidad: { principal: '#000', secundario: '#fff', logo: null },
              direccion: null,
              sedes: [{ id: 1, nombre: 'Sede Central', ubicacion: 'Centro', activa: true }],
              servicios: [],
              horarios: [],
            })),
          },
        },
      ],
    });
    const component = TestBed.inject(DoctorEntityLinksAdmin);
    component.ngOnInit();
    return { component, service };
  }

  it('carga el listado administrativo', () => {
    const { component, service } = setup();
    expect(service.listarVinculaciones).toHaveBeenCalled();
    expect(component.links()).toHaveLength(1);
  });

  it('envía row_version al suspender un vínculo', () => {
    const { component, service } = setup();
    component.openDetail(link());
    component.requestAction(link(), 'SUSPENDIDO');
    component.actionForm.controls.motivo.setValue('Solicitud de la entidad');
    component.confirmAction();
    expect(service.cambiarEstado).toHaveBeenCalledWith(1, {
      estado: 'SUSPENDIDO', motivo: 'Solicitud de la entidad', row_version: 3,
    });
  });

  it('informa 409 sin reintentar automáticamente', () => {
    const { component, service } = setup({
      cambiarEstado: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409 }))),
    });
    component.openDetail(link());
    component.requestAction(link(), 'SUSPENDIDO');
    component.actionForm.controls.motivo.setValue('Solicitud de la entidad');
    component.confirmAction();
    expect(service.cambiarEstado).toHaveBeenCalledTimes(1);
    expect(component.actionError()).toContain('no se reintentará');
  });

  it('envía las sedes asignadas al reemplazar asignaciones', () => {
    const { component, service } = setup();
    component.openDetail(link());
    component.editAssignments();
    component.toggleAssignmentSede(1, true);
    component.saveAssignments();
    expect(service.reemplazarAsignaciones).toHaveBeenCalledWith(1, {
      roles: [2], id_rol_principal: 2, especialidades: [], sedes: [1], row_version: 3,
    });
  });

  it('reemplaza las asignaciones con la versión actual', () => {
    const { component, service } = setup();
    component.openDetail(link());
    component.editAssignments();
    component.saveAssignments();
    expect(service.reemplazarAsignaciones).toHaveBeenCalledWith(1, {
      roles: [2], id_rol_principal: 2, especialidades: [], sedes: [], row_version: 3,
    });
  });
});
