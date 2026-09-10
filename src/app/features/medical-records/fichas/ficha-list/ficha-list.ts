import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FichaService } from '../../../../core/services/ficha.service';
import { FichaClinica } from '../../../../core/models/ficha.models';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-ficha-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './ficha-list.html',
  styleUrls: ['./ficha-list.css'],
})
export class FichaListComponent implements OnInit {
  private readonly fichaService = inject(FichaService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly fichas = this.fichaService.fichas;
  readonly isLoading = this.fichaService.isLoading;
  readonly totalRecords = this.fichaService.totalRecords;
  readonly currentUser = this.authService.currentUser;

  // Filtros
  estadoFiltro = signal<string>('TODOS');
  fechaFiltro = signal<string>('');

  // Modal Cancelación
  showCancelModal = signal<boolean>(false);
  fichaToCancel = signal<FichaClinica | null>(null);
  cancelErrorMessage = signal<string | null>(null);

  cancelForm = this.fb.group({
    motivo: ['', [Validators.required, Validators.minLength(5)]],
  });

  ngOnInit(): void {
    this.cargarFichas();
  }

  cargarFichas(): void {
    const estado = this.estadoFiltro() === 'TODOS' ? undefined : this.estadoFiltro();
    const fecha = this.fechaFiltro() || undefined;

    this.fichaService.listarFichas(
      undefined,
      undefined,
      undefined,
      fecha,
      estado,
      0,
      50
    ).subscribe();
  }

  onFilterChange(): void {
    this.cargarFichas();
  }

  limpiarFiltros(): void {
    this.estadoFiltro.set('TODOS');
    this.fechaFiltro.set('');
    this.cargarFichas();
  }

  openCancelModal(ficha: FichaClinica): void {
    this.fichaToCancel.set(ficha);
    this.cancelErrorMessage.set(null);
    this.cancelForm.reset();
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.fichaToCancel.set(null);
  }

  confirmCancel(): void {
    if (this.cancelForm.invalid || !this.fichaToCancel()) return;

    const id = this.fichaToCancel()!.id_ficha;
    const motivo = this.cancelForm.value.motivo!;

    this.fichaService.cancelarFicha(id, motivo).subscribe({
      next: () => {
        this.closeCancelModal();
        this.cargarFichas();
      },
      error: (err) => {
        const msg = err.error?.detail || 'No se pudo cancelar la ficha médica.';
        this.cancelErrorMessage.set(msg);
      },
    });
  }

  getStatusBadgeClass(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'EMITIDA':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EN_ATENCION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FINALIZADA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELADA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }
}
