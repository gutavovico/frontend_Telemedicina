import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LaboratoryOrdersService } from '../../services/laboratory-orders.service';
import { OrdenLaboratorioResponse, OrdenLaboratorioDownloadResponse, EstadoOrden } from '../../models/laboratory-order.models';

@Component({
  selector: 'app-laboratory-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './laboratory-order-detail.html',
  styleUrl: './laboratory-order-detail.css'
})
export class LaboratoryOrderDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly service = inject(LaboratoryOrdersService);

  readonly downloadInfo = signal<OrdenLaboratorioDownloadResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoadingDownload = signal<boolean>(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Identificador de orden inválido.');
      return;
    }
    this.service.getOrderById(id).subscribe({
      error: () => this.errorMessage.set('No se pudo encontrar la orden solicitada.')
    });
  }

  loadDownloadUrl(): void {
    const order = this.service.selectedOrder();
    if (!order) return;
    this.isLoadingDownload.set(true);
    this.service.downloadOrder(order.id_orden).subscribe({
      next: (info) => this.downloadInfo.set(info),
      error: () => this.errorMessage.set('No tiene permisos para descargar esta orden.'),
      complete: () => this.isLoadingDownload.set(false)
    });
  }

  async downloadFile(): Promise<void> {
    const info = this.downloadInfo();
    if (!info) return;
    try {
      const blob = await this.service.loadDocumentBlob(info.url_firmada);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.nombre_archivo;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      this.errorMessage.set('No se pudo descargar el archivo.');
    }
  }

  getEstadoClass(estado: EstadoOrden): string {
    switch (estado) {
      case 'FIRMADA': return 'bg-emerald-100 text-emerald-800';
      case 'BORRADOR': return 'bg-amber-100 text-amber-800';
      case 'ANULADA': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getEstadoIcon(estado: EstadoOrden): string {
    switch (estado) {
      case 'FIRMADA': return 'verified';
      case 'BORRADOR': return 'edit';
      case 'ANULADA': return 'cancel';
      default: return 'help';
    }
  }

  formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  formatDateTime(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  }

  goBack(): void {
    this.router.navigate(['/ordenes-laboratorio']);
  }
}