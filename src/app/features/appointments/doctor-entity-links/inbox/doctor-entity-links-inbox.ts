import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { DoctorEntityLink, DoctorEntityLinkState } from '../../../../core/models/doctor-entity-link.models';
import { DoctorEntityLinkService } from '../../../../core/services/doctor-entity-link.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { DoctorEntityAvailableClinic } from '../../../../core/models/doctor-entity-link.models';

@Component({
  selector: 'app-doctor-entity-links-inbox',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Header],
  templateUrl: './doctor-entity-links-inbox.html',
})
export class DoctorEntityLinksInbox implements OnInit {
  private readonly linksService = inject(DoctorEntityLinkService);
  private readonly tenantService = inject(TenantService);
  private readonly fb = inject(FormBuilder);

  readonly links = signal<DoctorEntityLink[]>([]);
  readonly loading = signal(true);
  readonly actionLoading = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly page = signal(1);
  readonly perPage = 20;
  readonly total = signal(0);
  readonly stateFilter = signal<DoctorEntityLinkState | ''>('');
  readonly rejectingId = signal<number | null>(null);
  readonly availableClinics = signal<DoctorEntityAvailableClinic[]>([]);
  readonly selectedClinicId = computed(() => this.tenantService.selectedTenantId());
  readonly contextLoading = signal(false);

  readonly rejectionForm = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));
  readonly invitations = computed(() => this.links().filter((link) => link.estado === 'INVITADO'));

  ngOnInit(): void {
    this.load();
    this.loadAvailableClinics();
  }

  loadAvailableClinics(): void {
    this.linksService.listarMisEntidades().subscribe({
      next: (response) => {
        this.availableClinics.set(response.items);
        const selected = this.tenantService.selectedTenantId();
        if (selected !== null && !response.items.some((item) => item.id_clinica === selected)) {
          this.tenantService.setSelectedTenant(null);
        }
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.mapError(error, 'No fue posible consultar tus entidades disponibles.'));
      },
    });
  }

  selectClinic(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    if (!Number.isInteger(id) || id <= 0) return;
    this.contextLoading.set(true);
    this.errorMessage.set(null);
    this.tenantService.setSelectedTenant(id);
    this.tenantService.loadTenantContext().subscribe({
      next: (context) => {
        this.contextLoading.set(false);
        if (!context) {
          this.tenantService.clearTenant();
          this.errorMessage.set('La entidad seleccionada ya no está disponible.');
        }
      },
      error: () => {
        this.contextLoading.set(false);
        this.tenantService.clearTenant();
        this.errorMessage.set('La entidad seleccionada ya no está disponible.');
      },
    });
  }

  load(page = this.page()): void {
    this.loading.set(true); this.errorMessage.set(null);
    this.linksService.listarMisVinculaciones({ page, per_page: this.perPage, estado: this.stateFilter() || null }).subscribe({
      next: (response) => { this.links.set(response.items); this.total.set(response.total); this.page.set(response.page); this.loading.set(false); },
      error: (error: unknown) => { this.errorMessage.set(this.mapError(error, 'No fue posible consultar tus vínculos.')); this.loading.set(false); },
    });
  }

  applyFilter(): void { this.load(1); }
  previousPage(): void { if (this.page() > 1) this.load(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.load(this.page() + 1); }

  accept(link: DoctorEntityLink): void {
    this.actionLoading.set(link.id_vinculacion); this.errorMessage.set(null); this.successMessage.set(null);
    this.linksService.aceptarInvitacion(link.id_vinculacion).subscribe({
      next: (updated) => {
        this.actionLoading.set(null); this.successMessage.set('Invitación aceptada. El vínculo ya está activo.');
        this.replace(updated);
        // Refrescar el contexto: sin esto el guard sigue viendo clinica_id null
        // en localStorage y "Panel Médico" vuelve a redirigir aquí.
        this.tenantService.loadTenantContext().subscribe();
      },
      error: (error: unknown) => { this.actionLoading.set(null); this.errorMessage.set(this.mapError(error, 'No fue posible aceptar la invitación.')); },
    });
  }

  openReject(link: DoctorEntityLink): void {
    this.rejectingId.set(link.id_vinculacion); this.rejectionForm.reset({ motivo: '' }); this.errorMessage.set(null);
  }

  closeReject(): void { if (this.actionLoading() === null) this.rejectingId.set(null); }

  reject(): void {
    const id = this.rejectingId(); this.rejectionForm.markAllAsTouched();
    if (id === null || this.rejectionForm.invalid) return;
    const motivo = this.rejectionForm.controls.motivo.value.trim();
    this.actionLoading.set(id); this.errorMessage.set(null);
    this.linksService.rechazarInvitacion(id, { motivo }).subscribe({
      next: (updated) => {
        this.actionLoading.set(null); this.rejectingId.set(null); this.successMessage.set('Invitación rechazada.');
        this.replace(updated);
      },
      error: (error: unknown) => { this.actionLoading.set(null); this.errorMessage.set(this.mapError(error, 'No fue posible rechazar la invitación.')); },
    });
  }

  private replace(updated: DoctorEntityLink): void {
    this.links.update((items) => items.map((item) => item.id_vinculacion === updated.id_vinculacion ? updated : item));
  }

  private mapError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) return 'La sesión expiró. Inicia sesión nuevamente.';
    if (error.status === 403) return 'Esta invitación no pertenece a tu usuario.';
    if (error.status === 404) return 'La invitación ya no existe.';
    if (error.status === 409) return 'La invitación ya fue respondida o cambió de estado.';
    if (error.status === 422) return 'Los datos enviados no son válidos.';
    if (error.status >= 500) return 'Ocurrió un error inesperado. Intenta nuevamente más tarde.';
    return fallback;
  }
}
