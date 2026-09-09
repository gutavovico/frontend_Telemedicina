import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Header } from '../../shared/components/header/header';
import { MedicoService } from '../../core/services/medico.service';
import { RolesService } from '../../core/services/roles.service';
import { MedicalAgendaService } from './medical-agenda.service';
import { AgendaBlockForm } from './block-form/block-form';
import { MedicalAgendaPage } from './medical-agenda-page/medical-agenda-page';
import { BloqueoAgenda, DisponibilidadAgenda, ServicioAgenda } from './medical-agenda.models';
import { errorAgenda, etiquetaSlot, fechaBolivia, limitesServicio } from './medical-agenda.utils';

const servicio: ServicioAgenda = { id_servicio: 1, nombre: 'Consulta general', descripcion: null,
  hora_inicio: '08:00:00', hora_fin: '13:00:00', duracion_minutos: 30, costo: '100.00', estado: 'activo' };
const bloqueo: BloqueoAgenda = { id_bloqueo: 1, id_medico: 20, id_servicio: 1, fecha: '2026-09-10',
  hora_inicio: '10:00:00', hora_fin: '11:00:00', motivo: 'Ausencia', estado: 'PENDIENTE' };
const agenda: DisponibilidadAgenda = { id_medico: 20, id_servicio: 1, fecha: bloqueo.fecha,
  citas_verificadas: true, advertencias: [], slots: [] };

describe('CU05: límites y mensajes', () => {
  it('genera los límites de 30, 45 y 60 minutos desde los servicios', () => {
    expect(limitesServicio(servicio)).toHaveLength(11);
    expect(limitesServicio({ ...servicio, hora_inicio: '13:00', hora_fin: '16:00', duracion_minutos: 45 }))
      .toEqual(['13:00', '13:45', '14:30', '15:15', '16:00']);
    expect(limitesServicio({ ...servicio, hora_inicio: '16:00', hora_fin: '18:00', duracion_minutos: 60 }))
      .toEqual(['16:00', '17:00', '18:00']);
  });
  it('calcula mañana en Bolivia cerca del cambio de día UTC', () => {
    expect(fechaBolivia(1, new Date('2026-09-10T02:00:00Z'))).toBe('2026-09-10');
  });
  it('identifica un bloqueo y no inventa una cita para una indisponibilidad', () => {
    const slot = { hora_inicio: '10:00:00', hora_fin: '10:30:00', disponible: false };
    expect(etiquetaSlot(slot, agenda, [bloqueo])).toBe('Bloqueo pendiente');
    expect(etiquetaSlot(slot, agenda, [{ ...bloqueo, estado: 'APROBADO' }])).toBe('Bloqueado');
    expect(etiquetaSlot(slot, agenda, [])).toBe('No disponible');
    expect(etiquetaSlot(slot, { ...agenda, citas_verificadas: false }, [])).toBe('Sin verificar');
  });
  it('no atribuye al bloqueo un slot adyacente ni de otro médico', () => {
    expect(etiquetaSlot({ hora_inicio: '11:00', hora_fin: '11:30', disponible: false }, agenda, [bloqueo])).toBe('No disponible');
    expect(etiquetaSlot({ hora_inicio: '10:00', hora_fin: '10:30', disponible: false }, agenda,
      [{ ...bloqueo, id_medico: 50 }])).toBe('No disponible');
  });
  it('presenta mensajes 409 y validaciones 422 del backend', () => {
    expect(errorAgenda(new HttpErrorResponse({ status: 409, error: { detail: 'El horario ya existe' } }))).toBe('El horario ya existe');
    expect(errorAgenda(new HttpErrorResponse({ status: 422, error: { detail: [{ msg: 'Fecha inválida' }] } }))).toBe('Fecha inválida');
    expect(errorAgenda(new HttpErrorResponse({ status: 0 }))).toContain('conectar');
  });
});

describe('CU05: servicio HTTP', () => {
  let api: MedicalAgendaService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/appointments/agenda`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MedicalAgendaService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('consulta las rutas reales y envía filtros con HttpParams', () => {
    api.getServicios().subscribe(); http.expectOne(`${base}/servicios`).flush([servicio]);
    api.getHorarios(20).subscribe(); http.expectOne(`${base}/horarios?id_medico=20`).flush([]);
    api.getBloqueos().subscribe(); http.expectOne(`${base}/bloqueos`).flush([]);
    api.getDisponibilidad(20, '2026-09-10', 1).subscribe();
    http.expectOne(`${base}/disponibilidad?id_medico=20&fecha=2026-09-10&id_servicio=1`).flush(agenda);
  });
  it('envía cuerpos exactos para horarios y bloqueo propio', () => {
    api.createHorario({ id_servicio: 1, dia_semana: 4 }).subscribe();
    const schedule = http.expectOne(`${base}/horarios`);
    expect(schedule.request.method).toBe('POST'); expect(schedule.request.body).toEqual({ id_servicio: 1, dia_semana: 4 }); schedule.flush({});
    api.updateHorarioEstado(7, 'inactivo').subscribe();
    const status = http.expectOne(`${base}/horarios/7/estado`);
    expect(status.request.method).toBe('PATCH'); expect(status.request.body).toEqual({ estado: 'inactivo' }); status.flush({});
    const payload = { id_servicio: 1, fecha: '2026-09-10', hora_inicio: '10:00:00', hora_fin: '11:00:00', motivo: 'Ausencia' };
    api.createBloqueo(payload).subscribe(); const block = http.expectOne(`${base}/bloqueos`);
    expect(block.request.body).toEqual(payload); expect(block.request.method).toBe('POST'); block.flush({});
  });
  it('aprueba, rechaza y libera mediante PATCH', () => {
    api.aprobarBloqueo(1).subscribe(); api.rechazarBloqueo(2).subscribe(); api.liberarBloqueo(3).subscribe();
    ['1/aprobar', '2/rechazar', '3/liberar'].forEach(action => {
      const request = http.expectOne(`${base}/bloqueos/${action}`);
      expect(request.request.method).toBe('PATCH'); request.flush({});
    });
  });
});

describe('CU05: formulario de bloqueo', () => {
  function create() {
    const fixture = TestBed.createComponent(AgendaBlockForm);
    fixture.componentRef.setInput('servicios', [servicio]); fixture.componentRef.setInput('rol', 'MEDICO');
    fixture.componentRef.setInput('medicoId', 20); fixture.componentRef.setInput('medicoNombre', 'Médico propio');
    fixture.detectChanges(); return fixture;
  }
  beforeEach(() => TestBed.configureTestingModule({ imports: [AgendaBlockForm] }));
  it('renderiza selectores de slots y rechaza campos vacíos', () => {
    const fixture = create(); const form = fixture.componentInstance;
    const submitted = vi.spyOn(form.submitted, 'emit'); form.submit();
    expect(submitted).not.toHaveBeenCalled(); expect(form.validationError()).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type=time]')).toBeNull();
    expect(form.limites()).toContain('12:30');
  });
  it('omite id_medico y estado en la solicitud propia válida', () => {
    const form = create().componentInstance;
    const submitted = vi.spyOn(form.submitted, 'emit');
    form.form.patchValue({ hora_inicio: '10:00', hora_fin: '11:00', motivo: ' Ausencia ' }); form.submit();
    expect(submitted).toHaveBeenCalledWith({ id_servicio: 1, fecha: fechaBolivia(1), hora_inicio: '10:00:00', hora_fin: '11:00:00', motivo: 'Ausencia' });
  });
  it('rechaza desalineación, orden inverso y fecha distinta a mañana', () => {
    const form = create().componentInstance; const submitted = vi.spyOn(form.submitted, 'emit');
    for (const values of [{ hora_inicio: '10:15', hora_fin: '11:00', fecha: fechaBolivia(1) },
      { hora_inicio: '11:00', hora_fin: '10:00', fecha: fechaBolivia(1) },
      { hora_inicio: '10:00', hora_fin: '11:00', fecha: fechaBolivia(2) }]) {
      form.form.patchValue({ ...values, motivo: 'Ausencia' }); form.submit(); expect(form.validationError()).toBeTruthy();
    }
    expect(submitted).not.toHaveBeenCalled();
  });
  it('incluye el médico seleccionado para un rol recepción confirmado', () => {
    const fixture = create(); fixture.componentRef.setInput('rol', 'RECEPCION'); fixture.detectChanges();
    const form = fixture.componentInstance; const submitted = vi.spyOn(form.submitted, 'emit');
    form.form.patchValue({ hora_inicio: '10:00', hora_fin: '11:00', motivo: 'Ausencia' }); form.submit();
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ id_medico: 20 }));
  });
  it('rechaza fechas inexistentes incluso sin la restricción de mañana', () => {
    const fixture = create(); fixture.componentRef.setInput('rol', 'RECEPCION'); fixture.detectChanges();
    const form = fixture.componentInstance; const submitted = vi.spyOn(form.submitted, 'emit');
    form.form.patchValue({ fecha: '2026-02-30', hora_inicio: '10:00', hora_fin: '11:00', motivo: 'Ausencia' });
    form.submit(); expect(submitted).not.toHaveBeenCalled(); expect(form.validationError()).toContain('fecha válida');
  });
});

@Component({ selector: 'app-header', standalone: true, template: '' })
class HeaderStub {}

describe('CU05: página y acciones', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let medicos: Record<string, ReturnType<typeof vi.fn>>;
  let roles: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    api = {
      getSesion: vi.fn(() => of({ id_usuario: 1, id_clinica: 1, id_rol: 1 })),
      getServicios: vi.fn(() => of([servicio])), getHorarios: vi.fn(() => of([])), getBloqueos: vi.fn(() => of([bloqueo])),
      getDisponibilidad: vi.fn(() => of(agenda)), createHorario: vi.fn(() => of({})), updateHorarioEstado: vi.fn(() => of({})),
      createBloqueo: vi.fn(() => of(bloqueo)),
      aprobarBloqueo: vi.fn(() => of({ ...bloqueo, estado: 'APROBADO', citas_afectadas: [9], notificaciones_creadas: 0, advertencias: ['Sin receptor'] }))
    };
    medicos = { obtenerMiPerfil: vi.fn(() => of({ id_medico: 20, id_usuario: 2, usuario: { nombres: 'Ana', apellidos: 'Paz' } })),
      listarMedicos: vi.fn(() => of({ total: 0, items: [] })) };
    roles = { getRoleById: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 403 }))) };
    TestBed.configureTestingModule({ imports: [MedicalAgendaPage], providers: [
      { provide: MedicalAgendaService, useValue: api }, { provide: MedicoService, useValue: medicos }, { provide: RolesService, useValue: roles }
    ] }).overrideComponent(MedicalAgendaPage, { remove: { imports: [Header] }, add: { imports: [HeaderStub] } });
  });
  async function create() {
    const fixture = TestBed.createComponent(MedicalAgendaPage); fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false)); fixture.detectChanges(); return fixture;
  }
  it('administración revisa pendientes sin controles de gestión de horarios', async () => {
    const fixture = await create(); const html = (fixture.nativeElement as HTMLElement).textContent;
    expect(html).toContain('Aprobar'); expect(html).not.toContain('Activar disponibilidad');
    expect(api['getServicios']).not.toHaveBeenCalled();
  });
  it('la aprobación refresca el listado y muestra advertencias', async () => {
    const page = (await create()).componentInstance; page.askAction(bloqueo, 'aprobar'); await page.confirmAction();
    expect(api['aprobarBloqueo']).toHaveBeenCalledWith(1); expect(api['getBloqueos']).toHaveBeenCalledTimes(2);
    expect(page.warnings()).toEqual(['Sin receptor']); expect(page.success()).toContain('Citas afectadas: 1');
  });
  it('habilita solo agenda propia tras confirmar perfil y acceso con backend', async () => {
    api['getSesion'].mockReturnValue(of({ id_usuario: 2, id_clinica: 1, id_rol: 2 }));
    const page = (await create()).componentInstance;
    expect(page.medicoId()).toBe(20); expect(page.manage()).toBe(true);
    expect(medicos['listarMedicos']).not.toHaveBeenCalled();
    page.askAction(bloqueo, 'aprobar'); expect(page.confirmation()).toBeNull();
    expect(page.canRelease({ ...bloqueo, id_medico: 99, estado: 'APROBADO' })).toBe(false);
  });
  it('no convierte id_rol 3 ni un 403 en autorización de recepción', async () => {
    api['getSesion'].mockReturnValue(of({ id_usuario: 3, id_clinica: 1, id_rol: 3 }));
    medicos['obtenerMiPerfil'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = await create(); const page = fixture.componentInstance;
    expect(page.rol()).toBe('DESCONOCIDO'); expect(page.limitation()).toContain('recepción');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Solicitar bloqueo');
    expect(medicos['listarMedicos']).not.toHaveBeenCalled();
  });
  it('impide duplicar un horario y conserva el mensaje 409 del servidor', async () => {
    const page = (await create()).componentInstance; page.rol.set('MEDICO'); page.medicoId.set(20);
    page.scheduleForm.setValue({ id_servicio: 1, dia_semana: 4 });
    page.horarios.set([{ id_horario: 8, id_medico: 20, id_servicio: 1, dia_semana: 4, estado: 'activo' }]);
    await page.createSchedule(); expect(api['createHorario']).not.toHaveBeenCalled(); expect(page.error()).toContain('ya está activo');
    page.horarios.set([]); api['createHorario'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Conflicto concurrente' } })));
    await page.createSchedule(); expect(page.error()).toBe('Conflicto concurrente'); expect(page.busy()).toBe(false);
  });
  it('no reutiliza disponibilidad anterior tras un error de consulta', async () => {
    const page = (await create()).componentInstance; page.rol.set('MEDICO'); page.medicoId.set(20);
    page.filters.patchValue({ id_servicio: 1 }); page.availability.set(agenda);
    api['getDisponibilidad'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await page.refresh(); expect(page.availability()).toBeNull(); expect(page.error()).toContain('conectar');
  });
});
