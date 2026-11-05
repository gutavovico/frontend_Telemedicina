import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SubscriptionPaymentService } from './services/subscription-payment.service';
import {
  CurrentSubscription,
  PlanVersion,
  SubscriptionPaymentItem,
} from './models/subscription-payment.model';

@Component({
  selector: 'app-subscription-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  /** ID canónico de la versión del plan seleccionada. */
  selectedPlanId = signal<number | null>(null);

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
            'Pago confirmado. La vigencia de tu suscripción fue actualizada.',
          );
          this.statusMessage.set(null);
        } else {
          this.statusMessage.set(
            `El pago aún está ${res.estado}. La confirmación llega por webhook; actualiza en unos segundos.`,
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
        const planVersionId = this.canonicalPlanVersionId(sub);
        if (planVersionId !== null) {
          this.selectedPlanId.set(planVersionId);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al obtener la suscripción');
      },
    });

    this.subService.getActivePlans().subscribe({
      next: (planes) => {
        this.plans.set(planes);
        if (this.selectedPlanId() === null && planes.length > 0) {
          this.selectedPlanId.set(planes[0].id_plan_version);
        }
      },
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

  iniciarCheckout(): void {
    const planId = this.selectedPlanId();
    if (planId === null) {
      this.errorMessage.set('Por favor, selecciona un plan');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.subService.createCheckout(planId).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set(null);
        this.statusMessage.set(
          `Sesión de pago creada por ${res.monto} ${res.moneda}. Redirigiendo a la pasarela segura...`,
        );
        // Redirige al checkout de Stripe
        if (res.checkout_url) {
          window.location.href = res.checkout_url;
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Error al generar la sesión de pago');
        this.loading.set(false);
      },
    });
  }

  private canonicalPlanVersionId(sub: CurrentSubscription): number | null {
    const value = sub.id_plan_version ?? sub.plan_version_id;
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 ? value : null;
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const id = Number(value);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    }
    return null;
  }

  limite(value: number | null): string {
    return value === null ? 'Sin límite' : String(value);
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
}

