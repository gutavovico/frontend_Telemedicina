import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { ClinicalDocumentsService } from '../../services/clinical-documents.service';
import { DocumentTypePipe } from '../../pipes/document-type.pipe';
import { DocumentViewer } from '../document-viewer/document-viewer';
import { DocumentoDownloadResponse } from '../../models/clinical-document.models';

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, Header, Footer, DocumentTypePipe, DocumentViewer],
  templateUrl: './document-detail.html',
  styleUrl: './document-detail.css'
})
export class DocumentDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly documentsService = inject(ClinicalDocumentsService);
  readonly authService = inject(AuthService);

  readonly downloadInfo = signal<DocumentoDownloadResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoadingDownload = signal<boolean>(false);
  readonly isAnulating = signal<boolean>(false);
  readonly previewUrl = signal<string | null>(null);
  readonly isLoadingPreview = signal<boolean>(false);

  // Computed: si hay previewUrl, la usamos; si hay downloadInfo, usamos su url_firmada
  readonly previewSource = computed(() => this.previewUrl() || this.downloadInfo()?.url_firmada || null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Identificador de documento inválido.');
      return;
    }
    this.documentsService.getDocumentById(id).subscribe({
      next: () => this.autoLoadPreview(),
      error: () => this.errorMessage.set('No se pudo encontrar el documento solicitado.')
    });
  }

  /** Carga automáticamente la vista previa al cargar el documento. */
  private autoLoadPreview(): void {
    const doc = this.documentsService.selectedDocument();
    if (doc) {
      this.isLoadingPreview.set(true);
      this.documentsService.getDownloadUrl(doc.id_documento).subscribe({
        next: (info) => {
          this.downloadInfo.set(info);
          this.previewUrl.set(info.url_firmada);
          this.isLoadingPreview.set(false);
        },
        error: () => {
          this.errorMessage.set('No tiene permisos para visualizar este documento.');
          this.isLoadingPreview.set(false);
        }
      });
    }
  }

  /** Fuerza recarga de la URL de descarga (para reintentar). */
  loadDownloadUrl(): void {
    const doc = this.documentsService.selectedDocument();
    if (!doc) return;
    this.isLoadingDownload.set(true);
    this.documentsService.getDownloadUrl(doc.id_documento).subscribe({
      next: (info) => {
        this.downloadInfo.set(info);
        this.previewUrl.set(info.url_firmada);
      },
      error: () => this.errorMessage.set('No tiene permisos para descargar este documento.'),
      complete: () => this.isLoadingDownload.set(false)
    });
  }

  async downloadFile(): Promise<void> {
    const info = this.downloadInfo();
    if (!info) return;
    try {
      const blob = await this.documentsService.loadDocumentBlob(info.url_firmada);
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

  anularDocumento(): void {
    const doc = this.documentsService.selectedDocument();
    if (!doc) return;
    if (!confirm(`¿Está seguro de anular el documento "${doc.titulo}"?`)) return;
    this.isAnulating.set(true);
    this.documentsService.deleteDocument(doc.id_documento).subscribe({
      next: () => this.router.navigate(['/documentos']),
      error: () => {
        this.isAnulating.set(false);
        this.errorMessage.set('No se pudo anular el documento.');
      }
    });
  }

  get isAdmin(): boolean {
    return this.authService.userRole() === 'admin';
  }
}