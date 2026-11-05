import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { AuthService } from '../../../../../core/services/auth.service';
import { TreatmentsService } from '../../services/treatments.service';
import {
  EstadoPlan,
  MedicamentoPlan,
  MedicamentoVigencia,
  NivelAdherencia,
  Plan,
  VigenciaUpdate,
} from '../../models/treatment.models';

@Component({
  selector: 'app-treatment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './treatment-detail.html',
  styleUrl: './treatment-detail.css',
})
export class TreatmentDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly treatmentsService = inject(TreatmentsService);
  readonly authService = inject(AuthService);

  // Estado principal
  readonly plan = signal<Plan | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);

  // Estados de acciones clínicas y toast
  readonly actionLoading = signal<boolean>(false);
  readonly actionError = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error'>('success');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Modales
  readonly modalEvolucionOpen = signal<boolean>(false);
  readonly notaEvolucion = signal<string>('');

  readonly modalVigenciaOpen = signal<boolean>(false);
  readonly nuevaFechaFin = signal<string>('');
  readonly motivoVigencia = signal<string>('');
  readonly selectedMedsForVigencia = signal<number[]>([]);

  readonly modalFinalizarOpen = signal<boolean>(false);
  readonly motivoFinalizar = signal<string>('');

  readonly modalSuspenderMedOpen = signal<boolean>(false);
  readonly modalReactivarMedOpen = signal<boolean>(false);
  readonly selectedMed = signal<MedicamentoPlan | null>(null);
  readonly motivoMedicamento = signal<string>('');

  // Computeds
  readonly isDoctor = computed<boolean>(() => this.authService.isDoctor());
  readonly isPlanActive = computed<boolean>(() => this.plan()?.estado === 'ACTIVO');
  readonly canManagePlan = computed<boolean>(() => this.isDoctor() && this.isPlanActive());

  readonly activeMedications = computed<MedicamentoPlan[]>(() => {
    const current = this.plan();
    return current ? current.medicamentos.filter((m) => m.estado === 'ACTIVO') : [];
  });

  readonly adherenciaPorcentaje = computed<number | null>(() => {
    const adh = this.plan()?.adherencia;
    if (!adh || adh.porcentaje === null || adh.porcentaje === undefined) return null;
    return adh.porcentaje;
  });

  readonly adherenciaPorcentajeClamped = computed<number>(() => {
    const pct = this.adherenciaPorcentaje();
    if (pct === null) return 0;
    return Math.min(100, Math.max(0, pct));
  });

  get adminBase(): string {
    return this.router.url.startsWith('/admin') ? '/admin' : '';
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      this.isLoading.set(false);
      this.errorMessage.set('Identificador de tratamiento inválido.');
      return;
    }
    this.cargarPlan(id);
  }

  cargarPlan(id?: number): void {
    const planId =
      id ?? this.plan()?.id_tratamiento ?? Number(this.route.snapshot.paramMap.get('id'));
    if (!planId) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.treatmentsService.getPlan(planId).subscribe({
      next: (data) => {
        this.plan.set(data);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.parseError(err, 'No se pudo cargar el plan de tratamiento.'));
      },
    });
  }

  mostrarToast(mensaje: string, tipo: 'success' | 'error' = 'success'): void {
    this.toastMessage.set(mensaje);
    this.toastType.set(tipo);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }

  cerrarToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastMessage.set(null);
  }

  // --- Modal Evolución ---
  abrirModalEvolucion(): void {
    this.notaEvolucion.set('');
    this.actionError.set(null);
    this.modalEvolucionOpen.set(true);
  }

  cerrarModalEvolucion(): void {
    this.modalEvolucionOpen.set(false);
    this.actionError.set(null);
  }

  guardarEvolucion(): void {
    const nota = this.notaEvolucion().trim();
    if (nota.length < 10 || nota.length > 4000) {
      this.actionError.set('La nota de evolución debe contener entre 10 y 4000 caracteres.');
      return;
    }

    const planId = this.plan()?.id_tratamiento;
    if (!planId) return;

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.treatmentsService.registrarEvolucion(planId, { nota }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cerrarModalEvolucion();
        this.mostrarToast('Evolución clínica registrada con éxito.');
        this.cargarPlan(planId);
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(this.parseError(err, 'Error al registrar la evolución clínica.'));
      },
    });
  }

  // --- Modal Prorrogar Vigencia ---
  abrirModalVigencia(): void {
    const actual = this.plan()?.fecha_fin ?? '';
    this.nuevaFechaFin.set('');
    this.motivoVigencia.set('');
    const activeIds = this.activeMedications().map((m) => m.id_medicamento_plan);
    this.selectedMedsForVigencia.set(activeIds);
    this.actionError.set(null);
    this.modalVigenciaOpen.set(true);
  }

  cerrarModalVigencia(): void {
    this.modalVigenciaOpen.set(false);
    this.actionError.set(null);
  }

  toggleMedForVigencia(idMed: number): void {
    const current = this.selectedMedsForVigencia();
    if (current.includes(idMed)) {
      this.selectedMedsForVigencia.set(current.filter((x) => x !== idMed));
    } else {
      this.selectedMedsForVigencia.set([...current, idMed]);
    }
  }

  isMedSelectedForVigencia(idMed: number): boolean {
    return this.selectedMedsForVigencia().includes(idMed);
  }

  guardarVigencia(): void {
    const nueva = this.nuevaFechaFin();
    const actual = this.plan()?.fecha_fin ?? '';
    const motivo = this.motivoVigencia().trim();

    if (!nueva || nueva <= actual) {
      this.actionError.set(`La nueva fecha debe ser estrictamente posterior a ${actual}.`);
      return;
    }

    if (motivo.length < 10 || motivo.length > 1000) {
      this.actionError.set('El motivo clínico debe tener entre 10 y 1000 caracteres.');
      return;
    }

    const planId = this.plan()?.id_tratamiento;
    if (!planId) return;

    const medicamentos: MedicamentoVigencia[] = this.selectedMedsForVigencia().map((id) => ({
      id_medicamento_plan: id,
      fecha_fin: nueva,
    }));

    const payload: VigenciaUpdate = {
      fecha_fin: nueva,
      motivo,
      medicamentos,
    };

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.treatmentsService.actualizarVigencia(planId, payload).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cerrarModalVigencia();
        this.mostrarToast('Vigencia del plan prorrogada correctamente.');
        this.cargarPlan(planId);
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(this.parseError(err, 'Error al prorrogar la vigencia del plan.'));
      },
    });
  }

  // --- Modal Finalizar Tratamiento ---
  abrirModalFinalizar(): void {
    this.motivoFinalizar.set('');
    this.actionError.set(null);
    this.modalFinalizarOpen.set(true);
  }

  cerrarModalFinalizar(): void {
    this.modalFinalizarOpen.set(false);
    this.actionError.set(null);
  }

  guardarFinalizar(): void {
    const motivo = this.motivoFinalizar().trim();
    if (motivo.length < 10 || motivo.length > 1000) {
      this.actionError.set('El motivo clínico de finalización debe tener entre 10 y 1000 caracteres.');
      return;
    }

    const planId = this.plan()?.id_tratamiento;
    if (!planId) return;

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.treatmentsService.finalizarPlan(planId, { motivo }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cerrarModalFinalizar();
        this.mostrarToast('Plan de tratamiento finalizado con éxito.');
        this.cargarPlan(planId);
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(this.parseError(err, 'Error al finalizar el plan de tratamiento.'));
      },
    });
  }

  // --- Modal Suspender Medicamento ---
  abrirModalSuspender(med: MedicamentoPlan): void {
    this.selectedMed.set(med);
    this.motivoMedicamento.set('');
    this.actionError.set(null);
    this.modalSuspenderMedOpen.set(true);
  }

  cerrarModalSuspender(): void {
    this.modalSuspenderMedOpen.set(false);
    this.selectedMed.set(null);
    this.actionError.set(null);
  }

  guardarSuspender(): void {
    const med = this.selectedMed();
    const planId = this.plan()?.id_tratamiento;
    const motivo = this.motivoMedicamento().trim();

    if (!med || !planId) return;

    if (motivo.length < 10 || motivo.length > 1000) {
      this.actionError.set('El motivo clínico de suspensión debe tener entre 10 y 1000 caracteres.');
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.treatmentsService
      .suspenderMedicamento(planId, med.id_medicamento_plan, { motivo })
      .subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.cerrarModalSuspender();
          this.mostrarToast(`Medicamento "${med.medicamento_nombre}" suspendido.`);
          this.cargarPlan(planId);
        },
        error: (err: unknown) => {
          this.actionLoading.set(false);
          this.actionError.set(this.parseError(err, 'Error al suspender el medicamento.'));
        },
      });
  }

  // --- Modal Reactivar Medicamento ---
  abrirModalReactivar(med: MedicamentoPlan): void {
    this.selectedMed.set(med);
    this.motivoMedicamento.set('');
    this.actionError.set(null);
    this.modalReactivarMedOpen.set(true);
  }

  cerrarModalReactivar(): void {
    this.modalReactivarMedOpen.set(false);
    this.selectedMed.set(null);
    this.actionError.set(null);
  }

  guardarReactivar(): void {
    const med = this.selectedMed();
    const planId = this.plan()?.id_tratamiento;
    const motivo = this.motivoMedicamento().trim();

    if (!med || !planId) return;

    if (motivo.length < 10 || motivo.length > 1000) {
      this.actionError.set('El motivo clínico de reactivación debe tener entre 10 y 1000 caracteres.');
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.treatmentsService
      .reactivarMedicamento(planId, med.id_medicamento_plan, { motivo })
      .subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.cerrarModalReactivar();
          this.mostrarToast(`Medicamento "${med.medicamento_nombre}" reactivado.`);
          this.cargarPlan(planId);
        },
        error: (err: unknown) => {
          this.actionLoading.set(false);
          this.actionError.set(this.parseError(err, 'Error al reactivar el medicamento.'));
        },
      });
  }

  // --- Clases visuales de ayuda ---
  getEstadoBadgeClasses(estado: EstadoPlan | string): string {
    switch (estado) {
      case 'ACTIVO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FINALIZADO':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SUSPENDIDO_POR_RECETA':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getEstadoLabel(estado: EstadoPlan | string): string {
    switch (estado) {
      case 'ACTIVO':
        return 'Activo';
      case 'FINALIZADO':
        return 'Finalizado';
      case 'SUSPENDIDO_POR_RECETA':
        return 'Suspendido por receta';
      default:
        return estado;
    }
  }

  getNivelAdherenciaBadgeClasses(nivel: NivelAdherencia | string): string {
    switch (nivel) {
      case 'OPTIMA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REGULAR':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CRITICA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'SIN_DATOS':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  getNivelAdherenciaLabel(nivel: NivelAdherencia | string): string {
    switch (nivel) {
      case 'OPTIMA':
        return 'Óptima';
      case 'REGULAR':
        return 'Regular';
      case 'CRITICA':
        return 'Crítica';
      case 'SIN_DATOS':
      default:
        return 'Sin datos';
    }
  }

  getAdherenciaBarColor(nivel: NivelAdherencia | string): string {
    switch (nivel) {
      case 'OPTIMA':
        return 'bg-emerald-500';
      case 'REGULAR':
        return 'bg-amber-500';
      case 'CRITICA':
        return 'bg-rose-500';
      case 'SIN_DATOS':
      default:
        return 'bg-slate-300';
    }
  }

  private parseError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.error && typeof err.error === 'object' && 'detail' in err.error) {
        const detail = (err.error as { detail: unknown }).detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
          return detail[0].msg;
        }
      }
      if (err.status === 403) return 'No tiene permisos para realizar esta acción o consultar este plan.';
      if (err.status === 404) return 'Tratamiento no encontrado.';
      if (err.status === 409) return 'Conflicto con el estado actual del plan o medicamento.';
    }
    return fallback;
  }
}
