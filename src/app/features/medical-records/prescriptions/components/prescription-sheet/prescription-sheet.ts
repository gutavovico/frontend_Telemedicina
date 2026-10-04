import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecetaResponse } from '../../models/prescription.models';

@Component({
  selector: 'app-prescription-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prescription-sheet.html',
  styleUrl: './prescription-sheet.css',
})
export class PrescriptionSheet {
  @Input() receta: RecetaResponse | null = null;
  @Input() canDownload = false;
  @Input() canCancel = false;
  @Input() isDownloading = false;

  @Output() readonly downloadRequested = new EventEmitter<void>();
  @Output() readonly cancelRequested = new EventEmitter<void>();

  readonly showFullHash = signal<boolean>(false);

  readonly detallesOrdenados = computed(() => {
    const receta = this.receta;
    if (!receta) {
      return [];
    }
    return [...receta.detalles].sort((a, b) => a.posicion - b.posicion);
  });

  estadoTexto(): string {
    if (!this.receta) {
      return '';
    }
    if (this.receta.estado === 'ANULADA') {
      return 'Anulada';
    }
    if (this.receta.esta_vencida) {
      return 'Vencida';
    }
    return 'Vigente';
  }

  badgeClass(): string {
    if (!this.receta) {
      return 'bg-slate-100 text-slate-700 border-slate-200';
    }
    if (this.receta.estado === 'ANULADA') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (this.receta.esta_vencida) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  hashAbreviado(): string {
    const hash = this.receta?.hash_pdf ?? '';
    if (hash.length <= 16) {
      return hash;
    }
    return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
  }

  solicitarDescarga(): void {
    this.downloadRequested.emit();
  }

  solicitarAnulacion(): void {
    this.cancelRequested.emit();
  }

  alternarHash(): void {
    this.showFullHash.update((v) => !v);
  }
}
