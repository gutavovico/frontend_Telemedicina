import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { TreatmentsService } from '../../services/treatments.service';
import { Aviso, AvisoQueryParams, TipoAviso } from '../../models/treatment.models';

export interface TipoAvisoConfig {
  icon: string;
  label: string;
  badgeClass: string;
  iconBgClass: string;
  cardBorderClass: string;
}

@Component({
  selector: 'app-treatment-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './treatment-alerts.html',
  styleUrl: './treatment-alerts.css',
})
export class TreatmentAlerts implements OnInit {
  private readonly treatmentsService = inject(TreatmentsService);

  readonly avisos = signal<Aviso[]>([]);
  readonly total = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly soloNoLeidos = signal<boolean>(false);
  readonly marcandoIds = signal<Set<number>>(new Set());

  readonly page = signal<number>(1);
  readonly limit = signal<number>(10);

  readonly totalPages = computed(() => {
    const total = this.total();
    const limit = this.limit();
    return Math.max(1, Math.ceil(total / limit));
  });

  ngOnInit(): void {
    this.loadAvisos(1);
  }

  loadAvisos(page: number = 1): void {
    this.page.set(Math.max(1, page));
    const limit = this.limit();
    const skip = (this.page() - 1) * limit;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const queryParams: AvisoQueryParams = {
      skip,
      limit,
      no_leidos: this.soloNoLeidos() ? true : undefined,
    };

    this.treatmentsService.listAvisos(queryParams).subscribe({
      next: (res) => {
        this.avisos.set(res?.items ?? []);
        this.total.set(res?.total ?? 0);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.formatErrorMessage(err));
      },
    });
  }

  setFilter(soloNoLeidos: boolean): void {
    if (this.soloNoLeidos() === soloNoLeidos) return;
    this.soloNoLeidos.set(soloNoLeidos);
    this.loadAvisos(1);
  }

  marcarLeido(aviso: Aviso): void {
    if (aviso.leida_en || this.marcandoIds().has(aviso.id_aviso)) {
      return;
    }

    const nextSet = new Set(this.marcandoIds());
    nextSet.add(aviso.id_aviso);
    this.marcandoIds.set(nextSet);

    this.treatmentsService.marcarAvisoLeido(aviso.id_aviso).subscribe({
      next: (updated) => {
        const setAfter = new Set(this.marcandoIds());
        setAfter.delete(aviso.id_aviso);
        this.marcandoIds.set(setAfter);

        if (this.soloNoLeidos()) {
          this.avisos.update((list) => list.filter((a) => a.id_aviso !== aviso.id_aviso));
          this.total.update((t) => Math.max(0, t - 1));
        } else {
          const nowIso = updated?.leida_en ?? new Date().toISOString();
          this.avisos.update((list) =>
            list.map((a) =>
              a.id_aviso === aviso.id_aviso ? { ...a, leida_en: nowIso } : a
            )
          );
        }
      },
      error: (err: unknown) => {
        const setAfter = new Set(this.marcandoIds());
        setAfter.delete(aviso.id_aviso);
        this.marcandoIds.set(setAfter);
        this.errorMessage.set(
          'No fue posible marcar el aviso como leído. Intente de nuevo.'
        );
      },
    });
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.loadAvisos(this.page() + 1);
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.loadAvisos(this.page() - 1);
    }
  }

  onLimitChange(newLimit: number): void {
    this.limit.set(newLimit);
    this.loadAvisos(1);
  }

  getTipoConfig(tipo: TipoAviso): TipoAvisoConfig {
    switch (tipo) {
      case 'RECORDATORIO':
        return {
          icon: 'alarm',
          label: 'Recordatorio (30 min antes)',
          badgeClass: 'bg-teal-50 text-[#049CAB] border-teal-200',
          iconBgClass: 'bg-teal-50 text-[#049CAB]',
          cardBorderClass: 'border-l-4 border-l-[#049CAB]',
        };
      case 'OMISION':
        return {
          icon: 'warning',
          label: 'Omisión (60 min después)',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          iconBgClass: 'bg-amber-50 text-amber-600',
          cardBorderClass: 'border-l-4 border-l-amber-500',
        };
      case 'RIESGO_ABANDONO':
        return {
          icon: 'crisis_alert',
          label: 'Riesgo de abandono',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          iconBgClass: 'bg-rose-50 text-rose-600',
          cardBorderClass: 'border-l-4 border-l-rose-500',
        };
      default:
        return {
          icon: 'notifications',
          label: tipo,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
          iconBgClass: 'bg-slate-100 text-slate-600',
          cardBorderClass: 'border-l-4 border-l-slate-400',
        };
    }
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
    return 'Ocurrió un error inesperado al cargar la bandeja de avisos.';
  }
}
