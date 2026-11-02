import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { TreatmentsService } from '../../services/treatments.service';
import {
  EstadoPlan,
  NivelAdherencia,
  Plan,
  PlanQueryParams,
} from '../../models/treatment.models';

export interface BadgeConfig {
  label: string;
  class: string;
}

@Component({
  selector: 'app-treatment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './treatment-list.html',
  styleUrl: './treatment-list.css',
})
export class TreatmentList implements OnInit {
  private readonly treatmentsService = inject(TreatmentsService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly planes = signal<Plan[]>([]);
  readonly total = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly page = signal<number>(1);
  readonly limit = signal<number>(10);

  readonly estadoFiltro = signal<'' | EstadoPlan>('');
  readonly idPacienteFiltro = signal<string>('');

  readonly totalPages = computed(() => {
    const total = this.total();
    const limit = this.limit();
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly isDoctor = computed(() => this.authService.isDoctor());
  readonly isPaciente = computed(() => this.authService.isPaciente());
  readonly canEmit = computed(() => this.authService.isDoctor());

  ngOnInit(): void {
    this.loadPlans(1);
  }

  loadPlans(page: number = 1): void {
    this.page.set(Math.max(1, page));
    const limit = this.limit();
    const skip = (this.page() - 1) * limit;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const estado = (this.estadoFiltro() || undefined) as EstadoPlan | undefined;
    const idPacienteRaw = this.idPacienteFiltro().trim();
    // Solo el médico puede filtrar por ID de paciente ajeno
    const idPaciente =
      this.isDoctor() && idPacienteRaw !== '' && !Number.isNaN(Number(idPacienteRaw))
        ? Number(idPacienteRaw)
        : undefined;

    const queryParams: PlanQueryParams = {
      skip,
      limit,
      estado,
      id_paciente: idPaciente,
    };

    this.treatmentsService.listPlans(queryParams).subscribe({
      next: (res) => {
        this.planes.set(res?.items ?? []);
        this.total.set(res?.total ?? 0);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.formatErrorMessage(err));
      },
    });
  }

  onSearch(): void {
    this.loadPlans(1);
  }

  clearFilters(): void {
    this.estadoFiltro.set('');
    this.idPacienteFiltro.set('');
    this.loadPlans(1);
  }

  goToCreate(): void {
    this.router.navigate(['/tratamientos/crear']);
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.loadPlans(this.page() + 1);
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.loadPlans(this.page() - 1);
    }
  }

  onLimitChange(newLimit: number): void {
    this.limit.set(newLimit);
    this.loadPlans(1);
  }

  getEstadoBadge(estado: EstadoPlan): BadgeConfig {
    switch (estado) {
      case 'ACTIVO':
        return {
          label: 'Activo',
          class: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'FINALIZADO':
        return {
          label: 'Finalizado',
          class: 'bg-slate-100 text-slate-700 border-slate-200',
        };
      case 'SUSPENDIDO_POR_RECETA':
        return {
          label: 'Suspendido por receta',
          class: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      default:
        return {
          label: estado,
          class: 'bg-gray-100 text-gray-700 border-gray-200',
        };
    }
  }

  getAdherenciaBadge(nivel?: NivelAdherencia): BadgeConfig {
    switch (nivel) {
      case 'OPTIMA':
        return {
          label: 'Óptima',
          class: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'REGULAR':
        return {
          label: 'Regular',
          class: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'CRITICA':
        return {
          label: 'Crítica',
          class: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'SIN_DATOS':
      default:
        return {
          label: 'Sin datos',
          class: 'bg-gray-100 text-gray-600 border-gray-200',
        };
    }
  }

  getDiagnosticoTexto(plan: Plan): string {
    if (plan.diagnostico?.codigo_cie && plan.diagnostico?.descripcion) {
      return `${plan.diagnostico.codigo_cie} - ${plan.diagnostico.descripcion}`;
    }
    if (plan.diagnostico?.codigo_cie) {
      return plan.diagnostico.codigo_cie;
    }
    return 'Sin diagnóstico CIE asociado';
  }

  private formatErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.error?.detail) {
        return typeof err.error.detail === 'string'
          ? err.error.detail
          : JSON.stringify(err.error.detail);
      }
      if (err.status === 0) {
        return 'No fue posible conectar con el servidor. Verifique su conexión.';
      }
      return `Error del servidor (${err.status}): ${err.statusText}`;
    }
    return 'Ocurrió un error inesperado al cargar los planes de tratamiento.';
  }
}
