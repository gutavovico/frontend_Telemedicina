import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { ClinicasService } from '../../../core/services/clinicas.service';
import { ClinicaItem } from '../../../core/models/tenant.models';

@Component({
  selector: 'app-tenant-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-selector.html',
  styleUrls: ['./tenant-selector.css']
})
export class TenantSelectorComponent implements OnInit {
  readonly tenantService = inject(TenantService);
  private readonly clinicasService = inject(ClinicasService);

  readonly clinicas = signal<ClinicaItem[]>([]);
  readonly isLoading = signal(false);

  readonly selectedTenantIdStr = computed(() => {
    const id = this.tenantService.selectedTenantId();
    return id !== null && id !== undefined ? id.toString() : '';
  });

  ngOnInit(): void {
    if (this.tenantService.isSuperAdmin()) {
      this.cargarClinicas();
    }
  }

  cargarClinicas(): void {
    this.isLoading.set(true);
    this.clinicasService.listClinicas('ACTIVO', 1, 100).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.clinicas.set(res.items);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  onClinicaChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    const id = (value === '' || value === 'null') ? null : parseInt(value, 10);
    const tenantId = (id === null || isNaN(id)) ? null : id;

    this.tenantService.setSuperAdminTenant(tenantId).subscribe({
      next: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },
      error: () => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    });
  }
}
