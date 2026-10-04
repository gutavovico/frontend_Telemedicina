import { DestroyRef, Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MedicoService } from '../../../../core/services/medico.service';
import { MedicalAgendaService } from '../medical-agenda.service';
import { MedicalAgendaPage } from './medical-agenda-page';

describe('CU5 rol de sesión', () => {
  async function initialize(rol: string | null, idRol = 3) {
    const api = {
      getSesion: vi.fn(() => of({ id_usuario: 3, id_clinica: 1, id_rol: idRol, rol })),
      getServicios: vi.fn(() => of([{ id_servicio: 1, estado: 'activo' }])),
      getHorarios: vi.fn(() => of([])), getBloqueos: vi.fn(() => of([])),
      getDisponibilidad: vi.fn(() => of({ slots: [], advertencias: [] })),
    };
    const medicos = {
      listarMedicos: vi.fn(() => of({ total: 1, items: [{ id_medico: 20 }] })),
      obtenerMiPerfil: vi.fn(() => of({ id_medico: 20 })),
    };
    const injector = Injector.create({ providers: [
      { provide: MedicalAgendaService, useValue: api },
      { provide: MedicoService, useValue: medicos },
      { provide: FormBuilder, useValue: new FormBuilder() },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: DestroyRef, useValue: { onDestroy: vi.fn() } },
    ] });
    const page = runInInjectionContext(injector, () => new MedicalAgendaPage());
    await page.initialize();
    injector.destroy();
    return { page, api, medicos };
  }

  it('Recepción carga agenda sin depender del catálogo de roles', async () => {
    const { page, api, medicos } = await initialize('Recepción');
    expect(page.rol()).toBe('RECEPCION');
    expect(page.manage()).toBe(true);
    expect(page.error()).toBeNull();
    expect(medicos.listarMedicos).toHaveBeenCalled();
    expect(medicos.obtenerMiPerfil).not.toHaveBeenCalled();
    expect(api.getDisponibilidad).toHaveBeenCalledWith(20, expect.any(String), 1);
  });

  it.each([null, 'Paciente', 'desconocido'])('no infiere privilegios del id_rol para %s', async rol => {
    const { page, api, medicos } = await initialize(rol, 1);
    expect(page.rol()).toBe('DESCONOCIDO');
    expect(page.manage()).toBe(false);
    expect(api.getServicios).not.toHaveBeenCalled();
    expect(medicos.obtenerMiPerfil).not.toHaveBeenCalled();
  });

  it('Médico carga su perfil propio', async () => {
    const { page, medicos } = await initialize('Médico');
    expect(page.rol()).toBe('MEDICO');
    expect(medicos.obtenerMiPerfil).toHaveBeenCalled();
    expect(medicos.listarMedicos).not.toHaveBeenCalled();
  });

  it('Administración sólo carga la revisión de bloqueos', async () => {
    const { page, api } = await initialize('Administración');
    expect(page.rol()).toBe('ADMIN');
    expect(page.manage()).toBe(false);
    expect(api.getBloqueos).toHaveBeenCalled();
    expect(api.getServicios).not.toHaveBeenCalled();
  });
});
