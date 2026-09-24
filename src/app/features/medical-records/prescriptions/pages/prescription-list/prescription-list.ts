import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { EstadoReceta, RecetaResponse } from '../../models/prescription.models';

@Component({
  selector: 'app-prescription-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './prescription-list.html',
  styleUrl: './prescription-list.css',
})
export class PrescriptionList implements OnInit {
  private readonly service = inject(PrescriptionsService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly recetas = signal<RecetaResponse[]>([]);
  readonly total = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly page = signal<number>(1);
  readonly limit = signal<number>(10);

  readonly estadoFiltro = signal<'' | EstadoReceta>('');
  readonly idPacienteFiltro = signal<string>('');
  readonly idMedicoFiltro = signal<string>('');
  readonly desdeFiltro = signal<string>('');
  readonly hastaFiltro = signal<string>('');

  readonly totalPages = computed(() => {
    const total = this.total();
    const limit = this.limit();
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly isPaciente = computed(() => this.authService.userRole() === 'paciente');
  readonly isStaff = computed(() => {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'doctor';
  });
  // Emisión exclusiva del médico (CU16, hallazgo 3): ADMIN no ve ni abre el
  // formulario. El backend exige además `prescriptions:issue` como autoridad.
  readonly canIssue = computed(() => this.authService.userRole() === 'doctor');

  ngOnInit(): void {
    this.loadPrescriptions(1);
  }

  loadPrescriptions(page: number = 1): void {
    this.page.set(Math.max(1, page));
    const limit = this.limit();
    const skip = (this.page() - 1) * limit;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const estado = this.estadoFiltro() === '' ? undefined : this.estadoFiltro();
    const idPacienteRaw = this.idPacienteFiltro().trim();
    const idMedicoRaw = this.idMedicoFiltro().trim();
    // Solo staff reconocido puede filtrar por alcance ajeno; paciente y rol
    // desconocido consultan únicamente lo que el backend retorna para su perfil.
    const idPaciente = this.isStaff() && idPacienteRaw !== '' ? Number(idPacienteRaw) : undefined;
    const idMedico = this.isStaff() && idMedicoRaw !== '' ? Number(idMedicoRaw) : undefined;

    this.service
      .listPrescriptions({
        skip,
        limit,
        estado: estado as EstadoReceta | undefined,
        id_paciente: Number.isNaN(idPaciente) ? undefined : idPaciente,
        id_medico: Number.isNaN(idMedico) ? undefined : idMedico,
        desde: this.desdeFiltro() || undefined,
        hasta: this.hastaFiltro() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.recetas.set(res.items);
          this.total.set(res.total);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(this.mensajeError(err));
        },
      });
  }

  onSearch(): void {
    this.loadPrescriptions(1);
  }

  clearFilters(): void {
    this.estadoFiltro.set('');
    this.idPacienteFiltro.set('');
    this.idMedicoFiltro.set('');
    this.desdeFiltro.set('');
    this.hastaFiltro.set('');
    this.loadPrescriptions(1);
  }

  openDetail(receta: RecetaResponse): void {
    void this.router.navigate(['/recetas', receta.id_receta]);
  }

  goToIssue(): void {
    void this.router.navigate(['/recetas/emitir']);
  }

  badgeClass(receta: RecetaResponse): string {
    if (receta.estado === 'ANULADA') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (receta.esta_vencida) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  estadoTexto(receta: RecetaResponse): string {
    if (receta.estado === 'ANULADA') {
      return 'Anulada';
    }
    if (receta.esta_vencida) {
      return 'Vencida';
    }
    return 'Vigente';
  }

  private mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const detail =
        typeof err.error === 'object' && err.error !== null && 'detail' in err.error
          ? String((err.error as { detail: unknown }).detail)
          : null;
      if (detail) {
        return detail;
      }
      if (err.status === 401) {
        return 'Sesión vencida. Inicie sesión nuevamente.';
      }
      if (err.status === 403) {
        return 'No tiene permiso para consultar recetas.';
      }
      if (err.status === 404) {
        return 'No se encontraron recetas para los filtros indicados.';
      }
    }
    return 'No se pudieron cargar las recetas. Intente nuevamente.';
  }
}
