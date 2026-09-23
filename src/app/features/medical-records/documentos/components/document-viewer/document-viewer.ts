import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ClinicalDocumentsService } from '../../services/clinical-documents.service';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-viewer.html',
  styleUrl: './document-viewer.css'
})
export class DocumentViewer implements OnChanges {
  @Input() downloadUrl = '';
  @Input() idDocumento = 0;

  private readonly documentsService = inject(ClinicalDocumentsService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly safePdfUrl = signal<SafeResourceUrl | null>(null);
  readonly rawPdfUrl = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
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
      this.rawPdfUrl.set(url);
      this.safePdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch {
      this.errorMessage.set('No se pudo cargar el documento PDF.');
    } finally {
      this.isLoading.set(false);
    }
  }
}