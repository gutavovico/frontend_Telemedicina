import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { VersionPlan as CatalogVersion, NOMBRES_SERVICIOS } from '../../../core/models/plan.models';
import { RouterModule } from '@angular/router';
import { SubscriptionPaymentService } from './services/subscription-payment.service';
import {
  CurrentSubscription,
  ChangeQuote, SubscriptionChange,
  PlanVersion,
  SubscriptionPaymentItem,
} from './models/subscription-payment.model';

@Component({
  selector: 'app-subscription-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './subscription-payment.component.html',
  styleUrls: ['./subscription-payment.component.css'],
})
export class SubscriptionPaymentComponent implements OnInit {
  private readonly subService: SubscriptionPaymentService;

  readonly subscription = signal<CurrentSubscription | null>(null);
  readonly plans = signal<PlanVersion[]>([]);
  readonly payments = signal<SubscriptionPaymentItem[]>([]);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);

  // Selección de plan y ciclo
  selectedPlanId = signal<number | null>(null);
  selectedCycle = signal<'MENSUAL'>('MENSUAL');
  readonly mode = new FormControl<'IMMEDIATE' | 'NEXT_CYCLE'>('NEXT_CYCLE', { nonNullable: true });
  readonly quoteResult = signal<ChangeQuote | null>(null);
  readonly changes = signal<SubscriptionChange[]>([]);
  readonly confirmation = signal<'CHANGE' | 'CANCEL' | null>(null);
  readonly renewalReview = signal<CatalogVersion | null>(null);
  readonly pendingCheckout = signal<string | null>(null);
  readonly planPage = signal(0);
  readonly visiblePlans = computed(() => this.plans().slice(this.planPage() * 3, this.planPage() * 3 + 3));
  readonly selectedPlan = computed(() => this.plans().find(plan => plan.id === this.selectedPlanId()) ?? null);
  readonly lastRequest = signal<SubscriptionChange | null>(null);
  readonly requestFeedback = computed(() => {
    const last = this.lastRequest();
    return last ? this.changes().find(change => change.id === last.id) ?? last : this.changes()[0] ?? null;
  });
  private quoteSequence = 0;
  private requestKey: string | null = null;

  constructor(subService?: SubscriptionPaymentService) {
    this.subService = subService ?? inject(SubscriptionPaymentService);
  }

  ngOnInit(): void {
    this.loadData();
    this.procesarRetornoCheckout();
  }

  private procesarRetornoCheckout(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;

    if (checkout === 'cancelled') {
      this.statusMessage.set('El pago fue cancelado. Puedes reintentar con el mismo plan y ciclo.');
      return;
    }

    const idPago = params.get('pago');
    if (!idPago) {
      this.statusMessage.set('Estamos verificando el estado del pago con la pasarela.');
      return;
    }

    this.subService.synchronizeCheckout(idPago).subscribe({
      next: (res) => {
        if (res.confirmado) {
          this.successMessage.set(
            res.application_status === 'SCHEDULED'
              ? 'Pago confirmado. La versión aceptada se aplicará al inicio del nuevo ciclo.'
              : res.application_status === 'APPLIED' ? 'Pago confirmado y condiciones aplicadas.'
              : 'Pago confirmado; requiere revisión antes de aplicar el contrato.',
          );
          this.statusMessage.set(null);
        } else if (['FALLIDO', 'CANCELADO'].includes(res.estado)) {
          this.statusMessage.set('El pago no se completó. Se conserva el plan vigente.');
        } else {
          this.statusMessage.set(
            'Pago pendiente. Actualiza el estado en unos segundos; el plan vigente se conserva hasta confirmar el pago.',
          );
        }
        this.loadData();
      },
      error: () => {
        this.errorMessage.set(
          'No se pudo verificar el pago con la pasarela. Actualiza la página para reintentar sin generar un segundo cobro.',
        );
      },
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.subService.getCurrentSubscription().subscribe({
      next: (sub) => {
        this.subscription.set(sub);
        if (sub.plan_version_id) {
          this.selectedPlanId.set(sub.plan_version_id);
        }
      },
      error: (err) => {
        this.errorMessage.set(this.errorText(err));
      },
    });

    this.subService.getActivePlans().subscribe({
      next: (planes) => {
        this.plans.set(planes);
        if (this.planPage() * 3 >= planes.length) this.planPage.set(0);
        if (!this.selectedPlanId() && planes.length > 0) {
          this.selectedPlanId.set(planes[0].id_plan_version);
        }
      },
      error: () => this.errorMessage.set('No se pudo cargar el catálogo. Reintenta antes de elegir un destino.'),
    });

    this.subService.getChanges().subscribe({
      next: values => this.changes.set(values),
      error: () => this.errorMessage.set('No se pudieron consultar los cambios pendientes.'),
    });
    this.subService.getPaymentHistory().subscribe({
      next: (hist) => {
        this.payments.set(hist.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  renewalCandidate(): CatalogVersion | null {
    if (this.subscription()?.estado === 'CANCELLED') return null;
    const pending = this.changes().find(change => ['SCHEDULED','WAITING_PAYMENT','WAITING_RENEWAL'].includes(change.status));
    if (pending) return pending.operation === 'NEXT_CYCLE' ? pending.target_version ?? null : null;
    const sub = this.subscription();
    if (sub?.has_subscription && sub.estado !== 'TRIALING') {
      const planId = sub.version?.plan_id ?? this.plans().find(p => p.id === sub.plan_version_id)?.plan_id;
      return this.plans().find(p => p.plan_id === planId) ?? null;
    }
    return this.plans().find(p => p.id === this.selectedPlanId()) ?? null;
  }
  iniciarCheckout(): void {
    const version = this.renewalCandidate();
    if (!version) {
      this.errorMessage.set(this.selectedPlanId() ? 'No hay una versión disponible para renovar. Revisa las solicitudes pendientes.' : 'Por favor, selecciona un plan');
      return;
    }
    this.renewalReview.set({...version});
    this.errorMessage.set(null);
  }
  confirmRenewal(): void {
    const accepted = this.renewalReview();
    if (!accepted || !this.renewalCandidate()) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.subService.createCheckout(accepted.id, 'MENSUAL').subscribe({
      next: (res) => {
        this.loading.set(false);
        this.renewalReview.set(null);
        this.successMessage.set(null);
        this.statusMessage.set(
          `Sesión de pago creada por ${res.monto} ${res.moneda}. Redirigiendo a la pasarela segura...`,
        );
        // Redirige al checkout de Stripe
        if (res.checkout_url) {
          this.continueToCheckout(res.checkout_url);
        }
      },
      error: (err) => {
        this.errorMessage.set(this.errorText(err));
        this.loading.set(false);
      },
    });
  }

  descargarFactura(pago: SubscriptionPaymentItem): void {
    this.subService.downloadReceiptPdf(pago.id_pago).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${pago.numero_factura || pago.id_pago}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.errorMessage.set('No fue posible descargar la factura.');
      },
    });
  }
  selectPlan(id: number): void {
    this.quoteSequence++;
    this.loading.set(false);
    this.selectedPlanId.set(id);
    this.renewalReview.set(null);
    this.quoteResult.set(null);
    this.confirmation.set(null);
    this.requestKey = null;
  }
  prepareChange(): void {
    const id = this.selectedPlanId();
    if (!id) return;
    this.errorMessage.set(null);
    if (this.mode.value === 'NEXT_CYCLE') {
      this.confirmation.set('CHANGE');
      return;
    }
    this.loading.set(true);
    const sequence = ++this.quoteSequence;
    this.subService.quote(id).subscribe({
      next: quote => {
        if (sequence !== this.quoteSequence) return;
        this.quoteResult.set(quote); this.confirmation.set('CHANGE'); this.loading.set(false);
      },
      error: error => {
        if (sequence !== this.quoteSequence) return;
        this.quoteResult.set(null); this.errorMessage.set(this.errorText(error)); this.loading.set(false);
      }
    });
  }
  requestCancellation(): void {
    this.quoteSequence++;
    this.quoteResult.set(null);
    this.confirmation.set('CANCEL'); this.requestKey = null;
  }
  confirmRequest(): void {
    const operation = this.confirmation();
    const id = this.selectedPlanId();
    if (!operation || (operation === 'CHANGE' && !id)) return;
    if (operation === 'CHANGE' && this.mode.value === 'IMMEDIATE' && !this.quoteResult()) return;
    this.requestKey ??= crypto.randomUUID();
    this.loading.set(true);
    const request = operation === 'CANCEL' ? this.subService.cancel(this.requestKey)
      : this.subService.change(id!, this.mode.value, this.requestKey, this.quoteResult()?.quote_token);
    request.subscribe({
      next: result => {
        this.lastRequest.set(result);
        this.pendingCheckout.set(result.checkout_url);
        this.successMessage.set(result.status === 'WAITING_PAYMENT'
          ? 'Solicitud registrada. El plan actual se conserva hasta confirmar el pago.'
          : result.status === 'APPLIED' ? 'Cambio aplicado.' : 'Solicitud programada para el cierre del ciclo pagado.');
        this.confirmation.set(null); this.requestKey = null; this.quoteResult.set(null);
        this.loadData();
        if (result.status === 'WAITING_PAYMENT' && result.checkout_url) this.continueToCheckout(result.checkout_url);
      },
      error: error => { this.errorMessage.set(this.errorText(error)); this.loading.set(false); }
    });
  }
  hasPending(): boolean {
    const pending = ['SCHEDULED','WAITING_PAYMENT','WAITING_RENEWAL'];
    return this.changes().some(change => pending.includes(change.status))
      || pending.includes(this.requestFeedback()?.status ?? '');
  }
  continueToCheckout(url: string): void {
    window.location.assign(url);
  }
  changeMode(): void {
    this.selectPlan(this.selectedPlanId()!);
  }
  changeStatus(status: string): string {
    const labels: Record<string, string> = {
      WAITING_PAYMENT: 'Pago pendiente', SCHEDULED: 'Programada', WAITING_RENEWAL: 'Esperando renovación',
      APPLIED: 'Aplicada', FAILED: 'Pago fallido', REVIEW_REQUIRED: 'Requiere revisión', BLOCKED: 'Bloqueada',
    };
    return labels[status] ?? status;
  }
  operationLabel(operation: string): string {
    return ({IMMEDIATE: 'Cambio inmediato', NEXT_CYCLE: 'Cambio al siguiente ciclo', CANCEL: 'Cancelación'} as Record<string,string>)[operation] ?? operation;
  }
  latestCancellation(): SubscriptionChange | null {
    const last = this.lastRequest();
    return this.changes().find(change => change.operation === 'CANCEL') ?? (last?.operation === 'CANCEL' ? last : null);
  }
  serviceNames(version: { servicios_incluidos: string[] }): string {
    return version.servicios_incluidos.map(code => NOMBRES_SERVICIOS[code] ?? code).join(', ') || 'Sin servicios incluidos';
  }
  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      if (typeof detail === 'string') return detail;
      if (detail && typeof detail.message === 'string') return detail.message;
    }
    return 'No se pudo registrar la operación. Revisa el estado antes de reintentar.';
  }

}

