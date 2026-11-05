import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Header } from '../../../shared/components/header/header';
import { CheckoutResponse, Pago } from '../payments.models';
import { PaymentsService } from '../payments.service';

@Component({
  selector: 'app-payment-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink, Header],
  templateUrl: './payment-checkout.component.html',
  styleUrl: './payment-checkout.component.css',
})
export class PaymentCheckoutComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly payments = inject(PaymentsService);

  readonly idCita = Number(this.route.snapshot.paramMap.get('idCita'));
  readonly pago = signal<CheckoutResponse | Pago | null>(null);
  readonly cargando = signal(true);
  readonly procesando = signal(false);
  readonly descargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly qrObjectUrl = signal<string | null>(null);

  readonly esPagado = computed(() => (this.pago()?.estado || '').toUpperCase() === 'PAGADO');
  // Se conserva el modo detectado en el checkout aunque luego se reemplace el
  // pago por la respuesta de confirmación (que ya no incluye `simulado`).
  readonly modoSimulado = signal(false);

  private polling?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.iniciarCheckout();
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    this.revocarQr();
  }

  iniciarCheckout(): void {
    if (!this.idCita || Number.isNaN(this.idCita)) {
      this.error.set('No se indicó la cita a pagar.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.payments.crearCheckout(this.idCita, 'WEB').subscribe({
      next: (checkout) => {
        this.pago.set(checkout);
        this.modoSimulado.set(!!checkout.simulado);
        this.cargando.set(false);
        if ((checkout.estado || '').toUpperCase() !== 'PAGADO') {
          this.cargarQr(checkout.id_pago);
          this.iniciarPolling(checkout.id_pago);
        }
      },
      error: (err) => {
        this.error.set(this.mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  pagar(): void {
    const actual = this.pago();
    if (!actual) return;

    if (this.modoSimulado()) {
      this.confirmarSimulado(actual.id_pago);
      return;
    }

    if (!actual.url_checkout) {
      this.error.set('La pasarela no devolvió un enlace de pago. Intenta nuevamente.');
      return;
    }

    window.location.href = actual.url_checkout;
  }

  confirmarSimulado(idPago: number): void {
    this.procesando.set(true);
    this.payments.simularPago(idPago).subscribe({
      next: (pago) => {
        this.pago.set(pago);
        this.procesando.set(false);
        this.detenerPolling();
        this.revocarQr();
      },
      error: (err) => {
        this.error.set(this.mensajeError(err));
        this.procesando.set(false);
      },
    });
  }

  verificarEstado(): void {
    const actual = this.pago();
    if (!actual) return;

    this.procesando.set(true);
    this.payments.sincronizar(actual.id_pago).subscribe({
      next: (pago) => {
        this.pago.set(pago);
        this.procesando.set(false);
        if ((pago.estado || '').toUpperCase() === 'PAGADO') {
          this.detenerPolling();
          this.revocarQr();
        }
      },
      error: (err) => {
        this.error.set(this.mensajeError(err));
        this.procesando.set(false);
      },
    });
  }

  descargarComprobante(): void {
    const actual = this.pago();
    if (!actual) return;

    this.descargando.set(true);
    this.payments.descargarComprobante(actual.id_pago).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.error.set('El comprobante no está disponible.');
          this.descargando.set(false);
          return;
        }
        const nombre =
          this.nombreDesdeCabecera(response.headers.get('Content-Disposition')) ||
          `comprobante-${actual.id_pago}.pdf`;
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        enlace.click();
        window.URL.revokeObjectURL(url);
        this.descargando.set(false);
      },
      error: (err) => {
        this.error.set(this.mensajeError(err));
        this.descargando.set(false);
      },
    });
  }

  irAHistorial(): void {
    this.router.navigate(['/pagos']);
  }

  formatoMonto(monto: number | string | null | undefined): string {
    return Number(monto ?? 0).toFixed(2);
  }

  qrPayload(): string | null {
    const actual = this.pago();
    return actual && 'qr_payload' in actual ? (actual as CheckoutResponse).qr_payload : null;
  }

  private cargarQr(idPago: number): void {
    this.payments.descargarQr(idPago).subscribe({
      next: (blob) => {
        this.revocarQr();
        this.qrObjectUrl.set(window.URL.createObjectURL(blob));
      },
      error: () => {
        // El QR es un apoyo visual; no bloquea el pago con tarjeta.
        this.qrObjectUrl.set(null);
      },
    });
  }

  private iniciarPolling(idPago: number): void {
    this.detenerPolling();
    this.polling = setInterval(() => {
      this.payments.sincronizar(idPago).subscribe({
        next: (pago) => {
          if ((pago.estado || '').toUpperCase() === 'PAGADO') {
            this.pago.set(pago);
            this.detenerPolling();
            this.revocarQr();
          }
        },
        error: () => undefined,
      });
    }, 6000);
  }

  private detenerPolling(): void {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = undefined;
    }
  }

  private revocarQr(): void {
    const actual = this.qrObjectUrl();
    if (actual) {
      window.URL.revokeObjectURL(actual);
      this.qrObjectUrl.set(null);
    }
  }

  private nombreDesdeCabecera(header: string | null): string | null {
    if (!header) return null;
    const match = /filename="?([^";]+)"?/i.exec(header);
    return match?.[1] ?? null;
  }

  private mensajeError(err: unknown): string {
    const detalle = (err as { error?: { detail?: string } })?.error?.detail;
    return detalle || 'No fue posible procesar la operación de pago. Intenta nuevamente.';
  }
}
