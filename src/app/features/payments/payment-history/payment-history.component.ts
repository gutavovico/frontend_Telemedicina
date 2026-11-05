import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Header } from '../../../shared/components/header/header';
import { CitaPendientePago, Pago } from '../payments.models';
import { PaymentsService } from '../payments.service';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, RouterLink, Header],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.css',
})
export class PaymentHistoryComponent implements OnInit {
  private readonly payments = inject(PaymentsService);

  readonly pagos = signal<Pago[]>([]);
  readonly pendientes = signal<CitaPendientePago[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly descargandoId = signal<number | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      pagos: this.payments.listarPagos(),
      pendientes: this.payments.listarPendientes(),
    }).subscribe({
      next: ({ pagos, pendientes }) => {
        this.pagos.set(pagos.items || []);
        this.pendientes.set(pendientes.items || []);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(
          (err as { error?: { detail?: string } })?.error?.detail ||
            'No fue posible cargar tus pagos.'
        );
        this.cargando.set(false);
      },
    });
  }

  descargar(pago: Pago): void {
    this.descargandoId.set(pago.id_pago);
    this.payments.descargarComprobante(pago.id_pago).subscribe({
      next: (response) => {
        const blob = response.body;
        if (blob) {
          const nombre =
            this.nombreDesdeCabecera(response.headers.get('Content-Disposition')) ||
            `comprobante-${pago.id_pago}.pdf`;
          const url = window.URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = nombre;
          enlace.click();
          window.URL.revokeObjectURL(url);
        }
        this.descargandoId.set(null);
      },
      error: (err) => {
        this.error.set(
          (err as { error?: { detail?: string } })?.error?.detail ||
            'No fue posible descargar el comprobante.'
        );
        this.descargandoId.set(null);
      },
    });
  }

  formatoMonto(monto: number | string | null | undefined): string {
    return Number(monto ?? 0).toFixed(2);
  }

  esPagado(pago: Pago): boolean {
    return (pago.estado || '').toUpperCase() === 'PAGADO';
  }

  private nombreDesdeCabecera(header: string | null): string | null {
    if (!header) return null;
    const match = /filename="?([^";]+)"?/i.exec(header);
    return match?.[1] ?? null;
  }
}
