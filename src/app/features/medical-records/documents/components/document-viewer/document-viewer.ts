import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { ClinicalDocumentsService } from '../../services/clinical-documents.service';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, PdfViewerModule],
  templateUrl: './document-viewer.html',
  styleUrl: './document-viewer.css'
})
export class DocumentViewer implements OnChanges, OnDestroy {
  @Input() downloadUrl = '';
  @Input() idDocumento = 0;

  private readonly documentsService = inject(ClinicalDocumentsService);

  readonly pdfSrc = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly renderText = false;
  readonly zoom = 1;
  readonly errorMessage = signal<string | null>(null);

  private objectUrl: string | null = null;

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    const urlChanged = changes['downloadUrl'] && this.downloadUrl;
    const idChanged = changes['idDocumento'] && this.idDocumento && this.downloadUrl;

    if (urlChanged || idChanged) {
      await this.loadPdf();
    }
  }

  ngOnDestroy(): void {
    // Limpiar object URL para evitar memory leaks
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.pdfSrc.set(null);
  }

  private async loadPdf(): Promise<void> {
    if (!this.downloadUrl) {
      this.errorMessage.set('URL de descarga no disponible.');
      this.pdfSrc.set(null);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const blob = await this.documentsService.loadDocumentBlob(this.downloadUrl, this.idDocumento);

      if (!blob || blob.size === 0) {
        throw new Error('El archivo PDF está vacío o no se pudo descargar.');
      }

      // Verificar que es un PDF válido
      if (blob.type !== 'application/pdf' && !blob.type.includes('pdf')) {
        console.warn('Tipo MIME inesperado:', blob.type);
      }

      // Revocar URL anterior si existe
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
      }

      this.objectUrl = URL.createObjectURL(blob);
      this.pdfSrc.set(this.objectUrl);
    } catch (err) {
      console.error('Error cargando PDF:', err);
      const message = err instanceof Error ? err.message : 'No se pudo cargar el documento PDF.';
      this.errorMessage.set(message);
      this.pdfSrc.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }
}
