import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { LaboratoryOrdersService } from '../../services/laboratory-orders.service';
import { EstadoOrden, OrdenLaboratorioListResponse, OrdenLaboratorioQueryParams } from '../../models/laboratory-order.models';

@Component({
  selector: 'app-laboratory-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './laboratory-order-list.html',
  styleUrl: './laboratory-order-list.css'
})
export class LaboratoryOrderList implements OnInit {
  readonly service = inject(LaboratoryOrdersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  currentPage = 1;
  pageSize = 10;
  searchTerm = '';
  selectedEstado: EstadoOrden | '' = '';
  fechaDesde = '';
  fechaHasta = '';

  actionFeedback = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(page: number = 1): void {
    this.currentPage = page;
    const params: OrdenLaboratorioQueryParams = {
      page: this.currentPage,
      page_size: this.pageSize,
      q: this.searchTerm || undefined,
      estado: this.selectedEstado || undefined,
      fecha_desde: this.fechaDesde || undefined,
      fecha_hasta: this.fechaHasta || undefined
    };

    this.service.getOrders(params).subscribe({
      error: () => this.showFeedback('Error al cargar las órdenes de laboratorio.', 'error')
    });
  }

  onSearch(): void {
    this.loadOrders(1);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedEstado = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.loadOrders(1);
  }

  viewOrder(order: OrdenLaboratorioListResponse): void {
    this.router.navigate(['/ordenes-laboratorio', order.id_orden]);
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

  showFeedback(message: string, type: 'success' | 'error'): void {
    this.actionFeedback.set({ message, type });
    setTimeout(() => this.actionFeedback.set(null), 4000);
  }
}