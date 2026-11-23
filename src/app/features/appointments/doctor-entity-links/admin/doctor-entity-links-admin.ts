import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  DoctorEntityCandidate,
  DoctorEntityLink,
  DoctorEntityLinkHistory,
  DoctorEntityLinkState,
  DoctorEntitySearchCriterion,
  DoctorEntitySede,
} from '../../../../core/models/doctor-entity-link.models';
import { DoctorEntityLinkService } from '../../../../core/services/doctor-entity-link.service';
import { MedicoService } from '../../../../core/services/medico.service';
import { Role } from '../../../../core/models/role.models';
import { EspecialidadResponse } from '../../../../core/models/medico.models';
import { RolesService } from '../../../../core/services/roles.service';
import { ConfigurationService } from '../../../tenants/entity-configuration/services/configuration.service';

type AdminAction = 'SUSPENDIDO' | 'ACTIVO' | 'BAJA';

@Component({
  selector: 'app-doctor-entity-links-admin',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './doctor-entity-links-admin.html',
})
export class DoctorEntityLinksAdmin implements OnInit {
  private readonly linksService = inject(DoctorEntityLinkService);
  private readonly rolesService = inject(RolesService);
  private readonly medicosService = inject(MedicoService);
  private readonly configurationService = inject(ConfigurationService);
  private readonly fb = inject(FormBuilder);

  readonly links = signal<DoctorEntityLink[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly specialties = signal<EspecialidadResponse[]>([]);
  readonly sedes = signal<DoctorEntitySede[]>([]);
  readonly candidate = signal<DoctorEntityCandidate | null>(null);
  readonly detail = signal<DoctorEntityLink | null>(null);
  readonly history = signal<DoctorEntityLinkHistory[]>([]);
  readonly credential = signal<{ correo: string; password_temporal: string; expira_en: string } | null>(null);
  readonly loading = signal(true);
  readonly candidateLoading = signal(false);
  readonly submitting = signal(false);
  readonly detailLoading = signal(false);
  readonly actionLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly candidateError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly page = signal(1);
  readonly perPage = 20;
  readonly total = signal(0);
  readonly stateFilter = signal<DoctorEntityLinkState | ''>('');
  readonly query = signal('');
  readonly pendingAction = signal<{ link: DoctorEntityLink; action: AdminAction } | null>(null);

  readonly candidateForm = this.fb.nonNullable.group({
    criterio: ['correo' as DoctorEntitySearchCriterion, Validators.required],
    valor: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
  });
  readonly inviteForm = this.fb.nonNullable.group({
    modo: ['EXISTENTE' as 'EXISTENTE' | 'NUEVO', Validators.required],
    nombres: [''], apellidos: [''], correo: ['', Validators.email], telefono: [''], documento_identidad: [''],
    roles: [[] as number[], Validators.required], idRolPrincipal: [0, Validators.required],
    especialidades: [[] as number[]], idEspecialidadPrincipal: [0],
    sedes: [[] as number[]],
  });
  readonly assignmentForm = this.fb.nonNullable.group({
    roles: [[] as number[], Validators.required], idRolPrincipal: [0, Validators.required],
    especialidades: [[] as number[]], idEspecialidadPrincipal: [0],
    sedes: [[] as number[]],
  });
  readonly actionForm = this.fb.nonNullable.group({
    motivo: ['', [Validators.minLength(3), Validators.maxLength(500)]],
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));

  ngOnInit(): void { this.loadCatalogs(); this.loadSedes(); this.loadLinks(); }

  loadCatalogs(): void {
    forkJoin({ roles: this.rolesService.getRoles(), specialties: this.medicosService.listarEspecialidades() }).subscribe({
      next: ({ roles, specialties }) => {
        this.roles.set(roles.filter((role) => !role.estado || role.estado.toUpperCase() === 'ACTIVO'));
        this.specialties.set(specialties.filter((item) => item.estado.toUpperCase() === 'ACTIVO'));
      },
      error: (error: unknown) => this.errorMessage.set(this.mapError(error, 'No fue posible cargar los catálogos de roles y especialidades.')),
    });
  }

  loadSedes(): void {
    // Las sedes pertenecen al catálogo de CU33; si no está disponible se omite.
    this.configurationService.leer().subscribe({
      next: (configuracion) => this.sedes.set(configuracion.sedes.filter((sede) => sede.activa)),
      error: () => this.sedes.set([]),
    });
  }

  loadLinks(page = this.page()): void {
    this.loading.set(true); this.errorMessage.set(null);
    this.linksService.listarVinculaciones({ page, per_page: this.perPage, estado: this.stateFilter() || null, q: this.query().trim() || null }).subscribe({
      next: (response) => { this.links.set(response.items); this.total.set(response.total); this.page.set(response.page); this.loading.set(false); },
      error: (error: unknown) => { this.errorMessage.set(this.mapError(error, 'No fue posible consultar los vínculos.')); this.loading.set(false); },
    });
  }

  applyFilters(): void { this.loadLinks(1); }
  clearFilters(): void { this.stateFilter.set(''); this.query.set(''); this.loadLinks(1); }
  previousPage(): void { if (this.page() > 1) this.loadLinks(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.loadLinks(this.page() + 1); }

  searchCandidate(): void {
    if (this.candidateForm.invalid) { this.candidateForm.markAllAsTouched(); return; }
    this.candidateLoading.set(true); this.candidateError.set(null); this.candidate.set(null);
    const { criterio, valor } = this.candidateForm.getRawValue();
    this.linksService.buscarCandidato(criterio, valor).subscribe({
      next: (candidate) => { this.candidate.set(candidate); this.inviteForm.patchValue({ modo: 'EXISTENTE' }); this.candidateLoading.set(false); },
      error: (error: unknown) => { this.candidateError.set(this.mapError(error, 'No se encontró un médico con ese criterio exacto.')); this.candidateLoading.set(false); },
    });
  }

  clearCandidate(): void { this.candidate.set(null); this.candidateError.set(null); }


  selectRoles(ids: number[]): void {
    this.inviteForm.controls.roles.setValue(ids);
    if (!ids.includes(this.inviteForm.controls.idRolPrincipal.value)) this.inviteForm.controls.idRolPrincipal.setValue(ids[0] ?? 0);
  }
  selectSpecialties(ids: number[]): void {
    this.inviteForm.controls.especialidades.setValue(ids);
    if (!ids.includes(this.inviteForm.controls.idEspecialidadPrincipal.value)) this.inviteForm.controls.idEspecialidadPrincipal.setValue(ids[0] ?? 0);
  }
  toggleRole(id: number, checked: boolean): void {
    const ids = this.inviteForm.controls.roles.value; this.selectRoles(checked ? [...ids, id] : ids.filter((item) => item !== id));
  }
  toggleSpecialty(id: number, checked: boolean): void {
    const ids = this.inviteForm.controls.especialidades.value; this.selectSpecialties(checked ? [...ids, id] : ids.filter((item) => item !== id));
  }
  toggleSede(id: number, checked: boolean): void {
    const ids = this.inviteForm.controls.sedes.value;
    this.inviteForm.controls.sedes.setValue(checked ? [...ids, id] : ids.filter((item) => item !== id));
  }
  toggleAssignmentSede(id: number, checked: boolean): void {
    const ids = this.assignmentForm.controls.sedes.value;
    this.assignmentForm.controls.sedes.setValue(checked ? [...ids, id] : ids.filter((item) => item !== id));
  }
  sedeNombre(id: number): string {
    return this.sedes().find((sede) => sede.id === id)?.nombre ?? `Sede ${id}`;
  }

  invite(): void {
    this.inviteForm.markAllAsTouched();
    if (this.inviteForm.invalid) { this.errorMessage.set('Completa los campos obligatorios y selecciona al menos un rol.'); return; }
    const value = this.inviteForm.getRawValue();
    if (value.modo === 'EXISTENTE' && !this.candidate()) {
      this.errorMessage.set('Busca y selecciona un médico existente antes de invitarlo.'); return;
    }
    if (value.modo === 'NUEVO' && (!value.nombres.trim() || !value.apellidos.trim() || !value.correo.trim())) {
      this.errorMessage.set('Para una cuenta nueva se requieren nombres, apellidos y correo.'); return;
    }
    if (value.idRolPrincipal <= 0 || value.roles.length === 0) { this.errorMessage.set('Selecciona al menos un rol y un rol principal.'); return; }
    this.submitting.set(true); this.errorMessage.set(null);
    const payload = {
      modo: value.modo,
      ...(value.modo === 'EXISTENTE' ? { id_usuario: this.candidate()?.id_usuario } : { usuario: {
        nombres: value.nombres.trim(), apellidos: value.apellidos.trim(), correo: value.correo.trim(),
        telefono: value.telefono.trim() || null, documento_identidad: value.documento_identidad.trim() || null,
      } }),
      asignaciones: {
        roles: value.roles, id_rol_principal: value.idRolPrincipal,
        especialidades: value.especialidades.map((id) => ({ id_especialidad: id, es_principal: id === value.idEspecialidadPrincipal })),
        sedes: value.sedes,
      },
    };
    this.linksService.crearVinculacion(payload).subscribe({
      next: (response) => {
        this.submitting.set(false); this.credential.set(response.credencial_temporal);
        this.successMessage.set('Invitación creada correctamente.'); this.candidate.set(null);
        this.inviteForm.reset({ modo: 'EXISTENTE', nombres: '', apellidos: '', correo: '', telefono: '', documento_identidad: '', roles: [], idRolPrincipal: 0, especialidades: [], idEspecialidadPrincipal: 0, sedes: [] });
        this.loadLinks(1);
      },
      error: (error: unknown) => { this.errorMessage.set(this.mapError(error, 'No fue posible crear la invitación.')); this.submitting.set(false); },
    });
  }

  dismissCredential(): void { this.credential.set(null); }


  openDetail(link: DoctorEntityLink): void {
    this.detail.set(link); this.history.set([]); this.detailLoading.set(true); this.actionError.set(null);
    this.linksService.obtenerDetalle(link.id_vinculacion).subscribe({
      next: (response) => { this.detail.set(response.vinculacion); this.history.set(response.historial); this.detailLoading.set(false); },
      error: (error: unknown) => { this.actionError.set(this.mapError(error, 'No fue posible cargar el detalle del vínculo.')); this.detailLoading.set(false); },
    });
  }
  closeDetail(): void { this.detail.set(null); this.history.set([]); this.actionError.set(null); }
  editAssignments(): void {
    const link = this.detail(); if (!link) return;
    this.assignmentForm.reset({
      roles: link.roles.map((role) => role.id_rol),
      idRolPrincipal: link.roles.find((role) => role.es_principal)?.id_rol ?? link.roles[0]?.id_rol ?? 0,
      especialidades: link.especialidades.map((specialty) => specialty.id_especialidad),
      idEspecialidadPrincipal: link.especialidades.find((specialty) => specialty.es_principal)?.id_especialidad ?? link.especialidades[0]?.id_especialidad ?? 0,
      sedes: link.sedes,
    });
  }
  toggleAssignmentRole(id: number, checked: boolean): void {
    const ids = this.assignmentForm.controls.roles.value;
    const next = checked ? [...ids, id] : ids.filter((item) => item !== id);
    this.assignmentForm.controls.roles.setValue(next);
    if (!next.includes(this.assignmentForm.controls.idRolPrincipal.value)) this.assignmentForm.controls.idRolPrincipal.setValue(next[0] ?? 0);
  }
  toggleAssignmentSpecialty(id: number, checked: boolean): void {
    const ids = this.assignmentForm.controls.especialidades.value;
    const next = checked ? [...ids, id] : ids.filter((item) => item !== id);
    this.assignmentForm.controls.especialidades.setValue(next);
    if (!next.includes(this.assignmentForm.controls.idEspecialidadPrincipal.value)) this.assignmentForm.controls.idEspecialidadPrincipal.setValue(next[0] ?? 0);
  }
  saveAssignments(): void {
    const link = this.detail(); this.assignmentForm.markAllAsTouched();
    if (!link || this.assignmentForm.invalid) return;
    const value = this.assignmentForm.getRawValue(); this.actionLoading.set(true); this.actionError.set(null);
    this.linksService.reemplazarAsignaciones(link.id_vinculacion, {
      roles: value.roles, id_rol_principal: value.idRolPrincipal,
      especialidades: value.especialidades.map((id) => ({ id_especialidad: id, es_principal: id === value.idEspecialidadPrincipal })),
      sedes: value.sedes, row_version: link.row_version,
    }).subscribe({
      next: (updated) => { this.actionLoading.set(false); this.detail.set(updated); this.successMessage.set('Roles, especialidades y sedes actualizados.'); this.loadLinks(this.page()); this.openDetail(updated); },
      error: (error: unknown) => { this.actionError.set(this.mapError(error, 'No fue posible reemplazar las asignaciones.')); this.actionLoading.set(false); },
    });
  }


  requestAction(link: DoctorEntityLink, action: AdminAction): void {
    this.pendingAction.set({ link, action }); this.actionForm.reset({ motivo: '' }); this.actionError.set(null);
  }
  cancelAction(): void { if (!this.actionLoading()) this.pendingAction.set(null); }
  confirmAction(): void {
    const pending = this.pendingAction(); if (!pending) return;
    const motivo = this.actionForm.controls.motivo.value.trim();
    if (pending.action !== 'ACTIVO' && motivo.length < 3) {
      this.actionForm.controls.motivo.setErrors({ minLength: true }); this.actionForm.controls.motivo.markAsTouched(); return;
    }
    this.actionLoading.set(true); this.actionError.set(null);
    this.linksService.cambiarEstado(pending.link.id_vinculacion, {
      estado: pending.action, motivo: pending.action === 'ACTIVO' ? null : motivo, row_version: pending.link.row_version,
    }).subscribe({
      next: (updated) => {
        this.actionLoading.set(false); this.pendingAction.set(null); this.detail.set(updated);
        this.successMessage.set(`Vínculo actualizado a ${updated.estado}.`); this.loadLinks(this.page()); this.openDetail(updated);
      },
      error: (error: unknown) => { this.actionError.set(this.mapError(error, 'No fue posible cambiar el estado del vínculo.')); this.actionLoading.set(false); },
    });
  }
  canSuspend(link: DoctorEntityLink): boolean { return link.estado === 'ACTIVO'; }
  canReactivate(link: DoctorEntityLink): boolean { return link.estado === 'SUSPENDIDO'; }
  canDeactivate(link: DoctorEntityLink): boolean { return link.estado === 'ACTIVO' || link.estado === 'SUSPENDIDO'; }

  private mapError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) return 'La sesión expiró. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes permisos para administrar vínculos en esta entidad.';
    if (error.status === 404) return 'El recurso solicitado no existe o no pertenece a esta entidad.';
    if (error.status === 409) return 'Conflicto: el vínculo cambió o ya existe. Actualiza la información; no se reintentará automáticamente.';
    if (error.status === 422) return this.extractValidationDetail(error) ?? 'Los datos enviados no son válidos.';
    if (error.status >= 500) return 'Ocurrió un error inesperado. Intenta nuevamente más tarde.';
    return fallback;
  }
  private extractValidationDetail(error: HttpErrorResponse): string | null {
    const detail: unknown = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'msg' in item) {
          const msg = (item as { msg?: unknown }).msg; return typeof msg === 'string' ? msg : null;
        }
        return null;
      }).filter((msg: string | null): msg is string => msg !== null);
      return messages.length ? messages.join(', ') : null;
    }
    return null;
  }
}
