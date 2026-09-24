import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, signal, type DestroyableInjector } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { MedicoService } from '../../../../core/services/medico.service';
import { AppointmentService } from '../../../../core/services/appointment.service';
import type { Cita } from '../../../../core/models/appointment.models';
import type { MedicoResponse } from '../../../../core/models/medico.models';
import { DoctorDashboard } from './doctor-dashboard';

function makePerfil(idMedico = 7): MedicoResponse {
  return {
    id_medico: idMedico,
    id_usuario: 11,
    matricula_profesional: 'MAT-00007',
    estado: 'activo',
    fecha_registro: '2026-01-01',
    usuario: {
      id_usuario: 11,
      nombres: 'Gustavo',
      apellidos: 'Sandoval',
      correo: 'medico@clinica.bo',
    },
    especialidades: [{ id_especialidad: 1, nombre: 'Medicina General', es_principal: true }],
  };
}

function makeCita(overrides: Partial<Cita> = {}): Cita {
  return {
    id_cita: 101,
    id_paciente: 201,
    id_medico: 7,
    fecha_cita: '2026-09-24',
    hora_inicio: '09:00',
    hora_fin: '09:30',
    motivo: 'Control general',
    estado: 'PENDIENTE',
    tipo_consulta: 'PRESENCIAL',
    notas: null,
    paciente_nombre: 'Maria Rodriguez',
    paciente_ci: 'ID: 123',
    paciente_iniciales: 'MR',
    medico_nombre: 'Dr(a). Gustavo Sandoval',
    especialidad_nombre: 'Medicina General',
    created_at: '2026-09-24T09:00:00',
    updated_at: '2026-09-24T09:00:00',
    ...overrides,
  };
}

describe('DoctorDashboard CU28 (citas reales)', () => {
  const routerMock = { navigate: vi.fn() };
  const authMock = {
    currentUser: signal(null),
    userDisplayName: vi.fn(() => 'Test User'),
    userInitials: vi.fn(() => 'TU'),
    userPhoto: vi.fn(() => null),
    logout: vi.fn(),
  };
  const medicoMock = { obtenerMiPerfil: vi.fn() };
  const appointmentMock = { listarCitas: vi.fn() };
  let injector: DestroyableInjector;

  function create(): DoctorDashboard {
    injector = Injector.create({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authMock },
        { provide: MedicoService, useValue: medicoMock },
        { provide: AppointmentService, useValue: appointmentMock },
      ],
    });
    return runInInjectionContext(injector, () => new DoctorDashboard());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    medicoMock.obtenerMiPerfil.mockReset();
    appointmentMock.listarCitas.mockReset();
  });

  it('carga perfil y citas filtradas por id_medico y fecha actual', () => {
    const perfil = makePerfil(7);
    const citas = [
      makeCita({ id_cita: 101, id_paciente: 201, estado: 'PENDIENTE', paciente_nombre: 'Maria Rodriguez' }),
      makeCita({ id_cita: 102, id_paciente: 202, estado: 'CONFIRMADA', paciente_nombre: 'Juan Perez' }),
    ];
    medicoMock.obtenerMiPerfil.mockReturnValue(of(perfil));
    appointmentMock.listarCitas.mockReturnValue(of({ total: 2, page: 1, page_size: 50, items: citas }));

    const comp = create();
    comp.ngOnInit();

    expect(medicoMock.obtenerMiPerfil).toHaveBeenCalledTimes(1);
    expect(appointmentMock.listarCitas).toHaveBeenCalledTimes(1);

    const args = appointmentMock.listarCitas.mock.calls[0];
    // listarCitas(q, fecha, estado, idMedico, idPaciente, page, pageSize)
    expect(args[3]).toBe(7);
    expect(args[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(comp.miPerfil()?.id_medico).toBe(7);
    expect(comp.agendaDelDia().length).toBe(2);
    expect(comp.agendaDelDia()[0].id_cita).toBe(101);
    expect(comp.agendaDelDia()[0].id_paciente).toBe(201);
    expect(comp.agendaDelDia()[0].estado).toBe('PENDIENTE');
    expect(comp.totalConsultasPendientes()).toBe(2);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('agenda vacía cuando la API no retorna citas', () => {
    medicoMock.obtenerMiPerfil.mockReturnValue(of(makePerfil(7)));
    appointmentMock.listarCitas.mockReturnValue(of({ total: 0, page: 1, page_size: 50, items: [] }));

    const comp = create();
    comp.ngOnInit();

    expect(comp.agendaDelDia().length).toBe(0);
    expect(comp.totalConsultasPendientes()).toBe(0);
    expect(comp.totalCitasHoy()).toBe(0);
    expect(comp.isLoading()).toBe(false);
    expect(comp.errorMessage()).toBeNull();
    injector.destroy();
  });

  it('muestra error cuando falla el perfil o las citas', () => {
    // Error de perfil
    medicoMock.obtenerMiPerfil.mockReturnValue(throwError(() => ({ error: { detail: 'Perfil no encontrado' } })));
    const comp1 = create();
    comp1.ngOnInit();
    expect(comp1.errorMessage()).toBe('Perfil no encontrado');
    expect(comp1.agendaDelDia().length).toBe(0);
    expect(comp1.isLoading()).toBe(false);
    expect(appointmentMock.listarCitas).not.toHaveBeenCalled();
    injector.destroy();

    vi.clearAllMocks();
    medicoMock.obtenerMiPerfil.mockReturnValue(of(makePerfil(7)));
    appointmentMock.listarCitas.mockReturnValue(throwError(() => ({ error: { detail: 'Error agenda' } })));
    const comp2 = create();
    comp2.ngOnInit();
    expect(comp2.errorMessage()).toBe('Error agenda');
    expect(comp2.agendaDelDia().length).toBe(0);
    expect(comp2.isLoading()).toBe(false);
    injector.destroy();
  });

  it('Atender navega con IDs reales a /pacientes/{id_paciente}/consultas/nueva?id_cita={id_cita}', () => {
    medicoMock.obtenerMiPerfil.mockReturnValue(of(makePerfil(7)));
    appointmentMock.listarCitas.mockReturnValue(of({ total: 0, page: 1, page_size: 50, items: [] }));
    const comp = create();
    comp.ngOnInit();

    const cita = comp.mapearCitaACitaAgenda(
      makeCita({ id_cita: 555, id_paciente: 777, estado: 'CONFIRMADA' })
    );
    expect(cita.id_cita).toBe(555);
    expect(cita.id_paciente).toBe(777);
    expect(cita.esAtendible).toBe(true);

    comp.atenderCita(cita);
    expect(routerMock.navigate).toHaveBeenCalledWith(
      ['/pacientes', 777, 'consultas', 'nueva'],
      { queryParams: { id_cita: 555 } }
    );
    injector.destroy();
  });

  it('excluye citas FINALIZADA, CANCELADA y COMPLETADA de acciones atendibles', () => {
    const perfil = makePerfil(7);
    const citas = [
      makeCita({ id_cita: 1, id_paciente: 11, estado: 'FINALIZADA' }),
      makeCita({ id_cita: 2, id_paciente: 12, estado: 'CANCELADA' }),
      makeCita({ id_cita: 3, id_paciente: 13, estado: 'COMPLETADA' }),
      makeCita({ id_cita: 4, id_paciente: 14, estado: 'PENDIENTE' }),
    ];
    medicoMock.obtenerMiPerfil.mockReturnValue(of(perfil));
    appointmentMock.listarCitas.mockReturnValue(of({ total: 4, page: 1, page_size: 50, items: citas }));

    const comp = create();
    comp.ngOnInit();

    const agenda = comp.agendaDelDia();
    expect(agenda.length).toBe(4);
    expect(agenda[0].esAtendible).toBe(false);
    expect(agenda[1].esAtendible).toBe(false);
    expect(agenda[2].esAtendible).toBe(false);
    expect(agenda[3].esAtendible).toBe(true);
    // Solo la pendiente cuenta como consulta pendiente
    expect(comp.totalConsultasPendientes()).toBe(1);

    // Atender no navega para no atendibles
    comp.atenderCita(agenda[0]);
    comp.atenderCita(agenda[1]);
    comp.atenderCita(agenda[2]);
    expect(routerMock.navigate).not.toHaveBeenCalled();

    // Sí navega para la atendible con IDs reales
    comp.atenderCita(agenda[3]);
    expect(routerMock.navigate).toHaveBeenCalledWith(
      ['/pacientes', 14, 'consultas', 'nueva'],
      { queryParams: { id_cita: 4 } }
    );
    injector.destroy();
  });
});
