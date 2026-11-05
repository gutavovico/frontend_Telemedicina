import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Header } from '../../../shared/components/header/header';
import { Pago } from '../payments.models';
import { PaymentsService } from '../payments.service';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, RouterLink, Header],
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.css',
})
export class PaymentResultComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly payments = inject(PaymentsService);

  readonly pago = signal<Pago | null>(null);
  readonly cargando = signal(true);
  readonly descargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly idPago = Number(this.route.snapshot.queryParamMap.get('pago'));

  readonly esPagado = computed(() => (this.pago()?.estado || '').toUpperCase() === 'PAGADO');

  ngOnInit(): void {
    if (!this.idPago || Number.isNaN(this.idPago)) {
      this.error.set('No se recibió la referencia del pago.');
      this.cargando.set(false);
      return;
    }
    this.verificar();
  }

  verificar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.payments.sincronizar(this.idPago).subscribe({
      next: (pago) => {
        this.pago.set(pago);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(
          (err as { error?: { detail?: string } })?.error?.detail ||
            'No fue posible verificar el estado del pago.'
        );
        this.cargando.set(false);
      },
    });
  }

  descargarComprobante(): void {
    this.descargando.set(true);
    this.payments.descargarComprobante(this.idPago).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.error.set('El comprobante no está disponible.');
          this.descargando.set(false);
          return;
        }
        const nombre =
          this.nombreDesdeCabecera(response.headers.get('Content-Disposition')) ||
          `comprobante-${this.idPago}.pdf`;
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        enlace.click();
        window.URL.revokeObjectURL(url);
        this.descargando.set(false);
      },
      error: (err) => {
        this.error.set(
          (err as { error?: { detail?: string } })?.error?.detail ||
            'No fue posible descargar el comprobante.'
        );
        this.descargando.set(false);
      },
    });
  }

  formatoMonto(monto: number | string | null | undefined): string {
    return Number(monto ?? 0).toFixed(2);
  }

  private nombreDesdeCabecera(header: string | null): string | null {
    if (!header) return null;
    const match = /filename="?([^";]+)"?/i.exec(header);
    return match?.[1] ?? null;
  }
}
