import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { Header } from '../../../../shared/components/header/header';
import { MedicoService } from '../../../../core/services/medico.service';
import { MedicoResponse } from '../../../../core/models/medico.models';
import { AgendaBlockForm } from '../block-form/block-form';
import { AgendaAvailabilityView } from '../availability-view/availability-view';
import { MedicalAgendaService } from '../medical-agenda.service';
import { AccionBloqueo, BloqueoAgenda, BloqueoCreate, DisponibilidadAgenda, HorarioAgenda, RolAgenda, ServicioAgenda } from '../medical-agenda.models';
import { DIAS_AGENDA, errorAgenda, fechaBolivia } from '../medical-agenda.utils';

@Component({
  selector: 'app-medical-agenda-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, A11yModule, Header, AgendaBlockForm, AgendaAvailabilityView],
  templateUrl: './medical-agenda-page.html', styleUrl: '../medical-agenda.css'
})
export class MedicalAgendaPage implements OnInit {
  private readonly api = inject(MedicalAgendaService);
  private readonly medicosApi = inject(MedicoService);
  private readonly fb = inject(FormBuilder);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private generation = 0;
  private destroyed = false;
  readonly rol = signal<RolAgenda>('DESCONOCIDO');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly limitation = signal<string | null>(null);
  readonly warnings = signal<string[]>([]);
  readonly servicios = signal<ServicioAgenda[]>([]);
  readonly horarios = signal<HorarioAgenda[]>([]);
  readonly bloqueos = signal<BloqueoAgenda[]>([]);
  readonly medicos = signal<MedicoResponse[]>([]);
  readonly medicoId = signal<number | null>(null);
  readonly availability = signal<DisponibilidadAgenda | null>(null);
  readonly blockModal = signal(false);
  readonly blockError = signal<string | null>(null);
  readonly confirmation = signal<{ bloqueo: BloqueoAgenda; accion: AccionBloqueo } | null>(null);
  readonly estadoFiltro = signal('TODOS');
  readonly dias = DIAS_AGENDA;
  readonly manage = computed(() => ['MEDICO', 'RECEPCION'].includes(this.rol()));
  readonly activeServices = computed(() => this.servicios().filter(s => s.estado.toLowerCase() === 'activo'));
  readonly filteredBlocks = computed(() => this.bloqueos().filter(b => this.estadoFiltro() === 'TODOS' || b.estado === this.estadoFiltro()));
  readonly pendingCount = computed(() => this.bloqueos().filter(b => b.estado === 'PENDIENTE').length);
  readonly medicoNombre = computed(() => this.nombreMedico(this.medicoId()));
  readonly filters = this.fb.nonNullable.group({
    id_medico: [0], id_servicio: [0, [Validators.required, Validators.min(1)]], fecha: [fechaBolivia(), Validators.required]
  });
  readonly scheduleForm = this.fb.nonNullable.group({
    id_servicio: [0, [Validators.required, Validators.min(1)]], dia_semana: [1, [Validators.min(1), Validators.max(7)]]
  });

  constructor() { inject(DestroyRef).onDestroy(() => { this.destroyed = true; this.generation++; }); }
  ngOnInit(): void { if (this.browser) void this.initialize(); }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.limitation.set(null);
    this.rol.set('DESCONOCIDO');
    this.servicios.set([]); this.medicos.set([]); this.medicoId.set(null);
    try {
      const session = await firstValueFrom(this.api.getSesion());
      if (session.id_clinica === null) {
        this.limitation.set('Tu usuario no tiene una clínica asociada. Solicita a administración que revise tu cuenta.');
        return;
      }
      const name = (session.rol ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
      if (['ADMIN', 'ADMINISTRADOR', 'ADMINISTRACION'].includes(name)) this.rol.set('ADMIN');
      else if (name === 'MEDICO' || name === 'RECEPCION') this.rol.set(name);
      if (this.rol() === 'DESCONOCIDO') {
        this.limitation.set('Tu sesi?n no tiene un rol autorizado para gestionar agendas.');
        return;
      }
      if (this.rol() === 'MEDICO') {
        const own = await firstValueFrom(this.medicosApi.obtenerMiPerfil());
        this.medicos.set([own]); this.medicoId.set(own.id_medico);
      }
      if (this.rol() === 'RECEPCION') {
        const doctors: MedicoResponse[] = [];
        let total = 0;
        do {
          const page = await firstValueFrom(this.medicosApi.listarMedicos({ skip: doctors.length, limit: 100 }));
          total = page.total; doctors.push(...page.items);
          if (!page.items.length) break;
        } while (doctors.length < total);
        this.medicos.set(doctors); this.medicoId.set(doctors[0]?.id_medico ?? null);
      }
      if (this.manage()) {
        const servicios = await firstValueFrom(this.api.getServicios());
        this.servicios.set(servicios);
        const first = this.activeServices()[0]?.id_servicio ?? 0;
        this.filters.patchValue({ id_servicio: first, id_medico: this.medicoId() ?? 0 });
        this.scheduleForm.controls.id_servicio.setValue(first);
      }
      await this.refresh();
    } catch (error) { if (!this.destroyed) this.error.set(errorAgenda(error)); }
    finally { if (!this.destroyed) this.loading.set(false); }
  }

  async refresh(): Promise<void> {
    const current = ++this.generation;
    this.loading.set(true); this.error.set(null);
    this.availability.set(null); this.horarios.set([]); this.bloqueos.set([]);
    try {
      const id = this.medicoId();
      const filters = this.filters.getRawValue();
      if (this.manage() && id !== null) {
        if (this.filters.invalid) { this.error.set('Selecciona servicio y fecha para consultar.'); return; }
        const result = await firstValueFrom(forkJoin({
          horarios: this.api.getHorarios(id), bloques: this.api.getBloqueos(id),
          agenda: this.api.getDisponibilidad(id, filters.fecha, filters.id_servicio)
        }));
        if (current !== this.generation || this.destroyed) return;
        this.horarios.set(result.horarios); this.bloqueos.set(result.bloques); this.availability.set(result.agenda);
      } else {
        const bloques = await firstValueFrom(this.api.getBloqueos());
        if (current === this.generation && !this.destroyed) this.bloqueos.set(bloques);
      }
    } catch (error) { if (current === this.generation && !this.destroyed) this.error.set(errorAgenda(error)); }
    finally { if (current === this.generation && !this.destroyed) this.loading.set(false); }
  }
  selectFilters(): void {
    if (this.busy()) return;
    if (this.rol() === 'RECEPCION') this.medicoId.set(this.filters.controls.id_medico.value || null);
    void this.refresh();
  }
  nombreServicio(id: number): string {
    return this.servicios().find(s => s.id_servicio === id)?.nombre ??
      ({ 1: 'Consulta general', 2: 'Consulta especializada', 3: 'Evaluación médica' } as Record<number, string>)[id] ?? `Servicio #${id}`;
  }
  nombreMedico(id: number | null): string {
    const medico = this.medicos().find(m => m.id_medico === id);
    return medico?.usuario ? `${medico.usuario.nombres} ${medico.usuario.apellidos}` : `Médico #${id ?? '—'}`;
  }
  canRelease(b: BloqueoAgenda): boolean {
    return b.estado === 'APROBADO' && (this.rol() === 'RECEPCION' || this.rol() === 'MEDICO' && b.id_medico === this.medicoId());
  }
  async createSchedule(): Promise<void> {
    if (!this.manage() || this.busy() || this.loading()) return;
    this.scheduleForm.markAllAsTouched();
    if (this.scheduleForm.invalid || !this.medicoId()) { this.error.set('Selecciona médico, servicio y día.'); return; }
    const value = this.scheduleForm.getRawValue();
    const existing = this.horarios().find(h => h.id_medico === this.medicoId() && h.id_servicio === value.id_servicio && h.dia_semana === value.dia_semana);
    if (existing) { this.error.set(existing.estado === 'activo' ? 'Este horario ya está activo.' : 'El horario existe. Reactívalo desde el listado.'); return; }
    await this.mutate(this.api.createHorario({ ...value, ...(this.rol() === 'RECEPCION' ? { id_medico: this.medicoId()! } : {}) }), 'Disponibilidad recurrente creada.');
  }
  async toggleSchedule(h: HorarioAgenda): Promise<void> {
    if (!this.manage() || this.busy() || this.loading()) return;
    await this.mutate(this.api.updateHorarioEstado(h.id_horario, h.estado === 'activo' ? 'inactivo' : 'activo'), 'Estado del horario actualizado.');
  }
  openBlock(): void { if (this.manage() && this.medicoId()) { this.blockError.set(null); this.blockModal.set(true); } }
  async submitBlock(payload: BloqueoCreate): Promise<void> {
    if (!this.manage() || this.busy()) return;
    this.blockError.set(null);
    await this.mutate(this.api.createBloqueo(payload), 'Solicitud enviada. Queda pendiente de aprobación.', true);
  }
  askAction(bloqueo: BloqueoAgenda, accion: AccionBloqueo): void {
    if (this.busy() || this.loading()) return;
    if (accion === 'liberar' ? this.canRelease(bloqueo) : this.rol() === 'ADMIN' && bloqueo.estado === 'PENDIENTE') {
      this.confirmation.set({ bloqueo, accion });
    }
  }
  async confirmAction(): Promise<void> {
    const target = this.confirmation();
    if (!target || this.busy()) return;
    const request = target.accion === 'aprobar' ? this.api.aprobarBloqueo(target.bloqueo.id_bloqueo) :
      target.accion === 'rechazar' ? this.api.rechazarBloqueo(target.bloqueo.id_bloqueo) : this.api.liberarBloqueo(target.bloqueo.id_bloqueo);
    this.busy.set(true); this.error.set(null); this.success.set(null); this.warnings.set([]);
    try {
      const response = await firstValueFrom(request);
      this.confirmation.set(null);
      this.success.set(`Bloqueo ${response.estado.toLowerCase()}.${target.accion === 'aprobar' ? ` Citas afectadas: ${response.citas_afectadas.length}. Avisos registrados: ${response.notificaciones_creadas}.` : ''}`);
      this.warnings.set(response.advertencias);
      await this.refresh();
    } catch (error) { this.confirmation.set(null); this.error.set(errorAgenda(error)); }
    finally { this.busy.set(false); }
  }
  private async mutate(request: Observable<unknown>, message: string, modal = false): Promise<void> {
    this.busy.set(true); this.error.set(null); this.success.set(null); this.warnings.set([]);
    try {
      await firstValueFrom(request);
      if (modal) this.blockModal.set(false);
      this.success.set(message); await this.refresh();
    } catch (error) { if (modal) this.blockError.set(errorAgenda(error)); else this.error.set(errorAgenda(error)); }
    finally { this.busy.set(false); }
  }
}
