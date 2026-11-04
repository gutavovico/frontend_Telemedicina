import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { TenantManagementService } from './services/tenant-management.service';
import {
  DeactivationRequestItem,
  TenantItem,
  TenantRequestDetail,
  TenantRequestItem,
} from './models/tenant-management.model';

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './tenant-management.component.html',
  styleUrls: ['./tenant-management.component.css'],
})
export class TenantManagementComponent implements OnInit {
  private readonly fb: FormBuilder;
  private readonly tenantService: TenantManagementService;

  readonly activeTab = signal<'requests' | 'tenants' | 'deactivations'>('requests');
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Solicitudes
  readonly requests = signal<TenantRequestItem[]>([]);
  readonly requestsStatusFilter = signal<string>('PENDING');
  readonly selectedRequest = signal<TenantRequestDetail | null>(null);

  // Tenants
  readonly tenants = signal<TenantItem[]>([]);
  readonly tenantsStatusFilter = signal<string>('ALL');
  readonly selectedTenant = signal<TenantItem | null>(null);
  readonly deactivationRequests = signal<DeactivationRequestItem[]>([]);

  // Formularios de modal
  readonly rejectForm: FormGroup;
  readonly suspendForm: FormGroup;
  readonly agreementForm: FormGroup;

  readonly showRejectModal = signal<boolean>(false);
  readonly showSuspendModal = signal<boolean>(false);
  readonly showAgreementModal = signal<boolean>(false);

  constructor(fb?: FormBuilder, tenantService?: TenantManagementService) {
    this.fb = fb ?? inject(FormBuilder);
    this.tenantService = tenantService ?? inject(TenantManagementService);

    this.rejectForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(3)]],
    });

    this.suspendForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(3)]],
    });

    this.agreementForm = this.fb.group({
      plan_id: [''],
      commercial_notes: [''],
    });
  }

  ngOnInit(): void {
    // Cada entrada del sidebar tiene su propia URL y pestaña inicial.
    if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '').endsWith('/admin/tenants')) {
      this.activeTab.set('tenants');
    }
    this.loadRequests();
    this.loadTenants();
    this.loadDeactivations();
  }

  setTab(tab: 'requests' | 'tenants' | 'deactivations'): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  loadRequests(): void {
    this.loading.set(true);
    const filter = this.requestsStatusFilter() === 'ALL' ? undefined : this.requestsStatusFilter();
    this.tenantService.listTenantRequests(filter).subscribe({
      next: (res) => {
        this.requests.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al cargar las solicitudes de tenant');
        this.loading.set(false);
      },
    });
  }

  loadTenants(): void {
    this.loading.set(true);
    const filter = this.tenantsStatusFilter() === 'ALL' ? undefined : this.tenantsStatusFilter();
    this.tenantService.listTenants(filter).subscribe({
      next: (res) => {
        this.tenants.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al cargar la lista de tenants');
        this.loading.set(false);
      },
    });
  }

  onFilterRequests(status: string): void {
    this.requestsStatusFilter.set(status);
    this.loadRequests();
  }

  onFilterTenants(status: string): void {
    this.tenantsStatusFilter.set(status);
    this.loadTenants();
  }

  loadDeactivations(): void {
    this.tenantService.listDeactivationRequests('PENDING').subscribe({
      next: (res) => this.deactivationRequests.set(res.items),
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al cargar las solicitudes de baja');
      },
    });
  }

  aprobarBaja(req: DeactivationRequestItem): void {
    if (!window.confirm(`¿Aprobar la baja de "${req.institucion}"? Se aplicará baja lógica y se conservarán sus datos clínicos.`)) {
      return;
    }
    this.tenantService.approveDeactivationRequest(req.id_deactivation, req.row_version).subscribe({
      next: () => {
        this.successMessage.set(`Baja de "${req.institucion}" aprobada; los datos clínicos se conservan.`);
        this.loadDeactivations();
        this.loadTenants();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al aprobar la baja');
      },
    });
  }

  rechazarBaja(req: DeactivationRequestItem): void {
    const motivo = window.prompt('Motivo del rechazo (mínimo 3 caracteres):')?.trim();
    if (!motivo || motivo.length < 3) return;
    this.tenantService.rejectDeactivationRequest(req.id_deactivation, req.row_version, motivo).subscribe({
      next: () => {
        this.successMessage.set(`Solicitud de baja de "${req.institucion}" rechazada.`);
        this.loadDeactivations();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al rechazar la baja');
      },
    });
  }

  // Solicitudes actions
  verDetalleSolicitud(req: TenantRequestItem): void {
    this.tenantService.getTenantRequest(req.id_request).subscribe({
      next: (detail) => {
        this.selectedRequest.set(detail);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudo obtener el detalle de la solicitud');
      },
    });
  }

  cerrarDetalleSolicitud(): void {
    this.selectedRequest.set(null);
  }

  documentosSolicitud(): Array<{ indice: number; nombre: string }> {
    const raw = this.selectedRequest()?.documentos_metadata;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((doc: { original_name?: string }, indice: number) => ({
        indice,
        nombre: doc?.original_name || `Documento ${indice + 1}`,
      }));
    } catch {
      return [];
    }
  }

  descargarDocumento(indice: number): void {
    const req = this.selectedRequest();
    if (!req) return;
    this.tenantService.downloadRequestDocument(req.id_request, indice).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.documentosSolicitud()[indice]?.nombre || `documento_${indice}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMessage.set(
          'El documento no está disponible en el almacenamiento. Intente más tarde.',
        );
      },
    });
  }

  async aprobarSolicitud(req: TenantRequestItem): Promise<void> {
    const { isConfirmed } = await Swal.fire({
      title: 'Aprobar solicitud',
      text: `¿Confirmas la aprobación del tenant "${req.institucion_nombre}"? Se creará su entorno administrativo.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!isConfirmed) {
      return;
    }

    this.loading.set(true);
    this.tenantService.approveTenantRequest(req.id_request, req.row_version).subscribe({
      next: () => {
        this.successMessage.set(`Tenant "${req.institucion_nombre}" aprobado y creado exitosamente.`);
        this.cerrarDetalleSolicitud();
        this.loadRequests();
        this.loadTenants();
      },
      error: (err) => {
        if (err.status === 409) {
          this.errorMessage.set('Conflicto: la solicitud ya fue procesada o su versión cambió.');
          this.loadRequests();
        } else {
          this.errorMessage.set(err?.error?.detail || 'Error al aprobar la solicitud');
        }
        this.loading.set(false);
      },
    });
  }

  abrirModalRechazo(req: TenantRequestItem): void {
    this.selectedRequest.set(req as TenantRequestDetail);
    this.rejectForm.reset();
    this.showRejectModal.set(true);
  }

  cerrarModalRechazo(): void {
    this.showRejectModal.set(false);
  }

  confirmarRechazo(): void {
    if (this.rejectForm.invalid || !this.selectedRequest()) {
      return;
    }
    const req = this.selectedRequest()!;
    const reason = this.rejectForm.value.reason;

    this.loading.set(true);
    this.tenantService.rejectTenantRequest(req.id_request, reason, req.row_version).subscribe({
      next: () => {
        this.successMessage.set(`Solicitud de "${req.institucion_nombre}" rechazada.`);
        this.cerrarModalRechazo();
        this.cerrarDetalleSolicitud();
        this.loadRequests();
      },
      error: (err) => {
        if (err.status === 409) {
          this.errorMessage.set('Conflicto de concurrencia: la solicitud cambió de estado.');
          this.loadRequests();
        } else {
          this.errorMessage.set(err?.error?.detail || 'Error al rechazar la solicitud');
        }
        this.loading.set(false);
      },
    });
  }

  // Tenants actions
  abrirModalSuspension(tenant: TenantItem): void {
    this.selectedTenant.set(tenant);
    this.suspendForm.reset();
    this.showSuspendModal.set(true);
  }

  cerrarModalSuspension(): void {
    this.showSuspendModal.set(false);
  }

  confirmarSuspension(): void {
    if (this.suspendForm.invalid || !this.selectedTenant()) {
      return;
    }
    const tenant = this.selectedTenant()!;
    const reason = this.suspendForm.value.reason;

    this.loading.set(true);
    this.tenantService
      .changeTenantStatus((tenant.tenant_id || tenant.id_clinica).toString(), 'suspend', {
        reason,
        row_version: tenant.row_version,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(
            `El tenant "${tenant.nombre}" fue suspendido. Las teleconsultas en curso e historias clínicas se conservan protegidas.`,
          );
          this.cerrarModalSuspension();
          this.loadTenants();
        },
        error: (err) => {
          if (err.status === 409) {
            this.errorMessage.set('Conflicto de versión: el tenant fue modificado por otro usuario.');
            this.loadTenants();
          } else {
            this.errorMessage.set(err?.error?.detail || 'Error al suspender el tenant');
          }
          this.loading.set(false);
        },
      });
  }

  estadoCanonico(estado: string): 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | string {
    const normalized = (estado || '').toUpperCase();
    if (normalized === 'ACTIVO') return 'ACTIVE';
    if (normalized === 'SUSPENDIDO') return 'SUSPENDED';
    if (normalized === 'INACTIVO') return 'INACTIVE';
    return normalized;
  }

  activarTenant(tenant: TenantItem): void {
    const reason = window.prompt('Motivo de la activación (mínimo 3 caracteres):')?.trim();
    if (!reason) return;

    this.loading.set(true);
    this.tenantService
      .changeTenantStatus((tenant.tenant_id || tenant.id_clinica).toString(), 'activate', {
        reason,
        row_version: tenant.row_version,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Tenant "${tenant.nombre}" activado exitosamente.`);
          this.loadTenants();
        },
        error: (err) => {
          if (err.status === 409) {
            this.errorMessage.set('Conflicto de versión o transición no permitida para este tenant.');
            this.loadTenants();
          } else {
            this.errorMessage.set(err?.error?.detail || 'Error al activar el tenant');
          }
          this.loading.set(false);
        },
      });
  }

  desactivarTenant(tenant: TenantItem): void {
    const reason = window.prompt('Motivo de la baja lógica (mínimo 3 caracteres):')?.trim();
    if (!reason) return;
    if (!window.confirm(`¿Confirmas dar de baja lógica al tenant "${tenant.nombre}"? Los datos clínicos se conservan.`)) {
      return;
    }

    this.loading.set(true);
    this.tenantService
      .changeTenantStatus((tenant.tenant_id || tenant.id_clinica).toString(), 'deactivate', {
        reason,
        row_version: tenant.row_version,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Tenant "${tenant.nombre}" dado de baja lógica; sus datos clínicos se conservan.`);
          this.loadTenants();
        },
        error: (err) => {
          if (err.status === 409) {
            this.errorMessage.set('Conflicto de versión o transición no permitida para este tenant.');
            this.loadTenants();
          } else {
            this.errorMessage.set(err?.error?.detail || 'Error al dar de baja el tenant');
          }
          this.loading.set(false);
        },
      });
  }

  reactivarTenant(tenant: TenantItem): void {
    if (!confirm(`¿Deseas reactivar el tenant "${tenant.nombre}"?`)) return;

    this.loading.set(true);
    this.tenantService
      .changeTenantStatus((tenant.tenant_id || tenant.id_clinica).toString(), 'reactivate', {
        reason: 'Reactivación administrativa',
        row_version: tenant.row_version,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Tenant "${tenant.nombre}" reactivado exitosamente.`);
          this.loadTenants();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.detail || 'Error al reactivar tenant');
          this.loading.set(false);
        },
      });
  }

  abrirModalAcuerdo(tenant: TenantItem): void {
    this.selectedTenant.set(tenant);
    this.agreementForm.patchValue({
      plan_id: tenant.plan_id || '',
      commercial_notes: tenant.commercial_notes || '',
    });
    this.showAgreementModal.set(true);
  }

  cerrarModalAcuerdo(): void {
    this.showAgreementModal.set(false);
  }

  confirmarAcuerdo(): void {
    if (!this.selectedTenant()) return;
    const tenant = this.selectedTenant()!;
    const val = this.agreementForm.value;

    this.loading.set(true);
    this.tenantService
      .updateCommercialAgreement((tenant.tenant_id || tenant.id_clinica).toString(), {
        plan_id: val.plan_id || undefined,
        commercial_notes: val.commercial_notes || undefined,
        row_version: tenant.row_version,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Acuerdo comercial de "${tenant.nombre}" actualizado.`);
          this.cerrarModalAcuerdo();
          this.loadTenants();
        },
        error: (err) => {
          if (err.status === 409) {
            this.errorMessage.set('Conflicto de versión al actualizar el acuerdo comercial.');
            this.loadTenants();
          } else {
            this.errorMessage.set(err?.error?.detail || 'Error al actualizar acuerdo comercial');
          }
          this.loading.set(false);
        },
      });
  }
}

