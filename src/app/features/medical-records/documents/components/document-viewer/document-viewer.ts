import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
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
export class DocumentViewer implements OnChanges {
  @Input() downloadUrl = '';
  @Input() idDocumento = 0;

  private readonly documentsService = inject(ClinicalDocumentsService);

  readonly pdfSrc = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly renderText = false;
  readonly zoom = 1;
  readonly errorMessage = signal<string | null>(null);

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if ((changes['downloadUrl'] && this.downloadUrl) || (changes['idDocumento'] && this.idDocumento && this.downloadUrl)) {
      await this.loadPdf();
    }
  }

  private async loadPdf(): Promise<void> {
    if (!this.downloadUrl) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const blob = await this.documentsService.loadDocumentBlob(this.downloadUrl);
      const url = URL.createObjectURL(blob);
      this.pdfSrc.set(url);
    } catch {
      this.errorMessage.set('No se pudo cargar el documento PDF.');
    } finally {
      this.isLoading.set(false);
    }
  }
}