import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { ClinicalDocumentsService } from '../../services/clinical-documents.service';
import { DocumentTypePipe, DocumentIconPipe } from '../../pipes/document-type.pipe';
import { DocumentoResumen, TipoDocumento } from '../../models/clinical-document.models';

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer, DocumentTypePipe, DocumentIconPipe],
  templateUrl: './document-list.html',
  styleUrl: './document-list.css'
})
export class DocumentList implements OnInit {
  readonly documentsService = inject(ClinicalDocumentsService);
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  currentPage = 1;
  pageSize = 10;

  searchTerm = '';
  selectedTipo: TipoDocumento | '' = '';
  fechaDesde = '';
  fechaHasta = '';
  idPacienteParam: number | null = null;
  isMyDocuments = false;

  tipos: TipoDocumento[] = ['RECETA', 'ORDEN_LAB', 'RESULTADO_LAB', 'CERTIFICADO', 'INDICACION'];

  actionFeedback = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.isMyDocuments = this.route.snapshot.data['modo'] === 'me';
    const pacienteParam = this.route.snapshot.paramMap.get('idPaciente') ?? this.route.snapshot.paramMap.get('id');
    this.idPacienteParam = pacienteParam ? Number(pacienteParam) : null;
    this.loadDocuments();
  }

  loadDocuments(page: number = 1): void {
    this.currentPage = page;
    const params = {
      page: this.currentPage,
      page_size: this.pageSize,
      q: this.searchTerm || undefined,
      tipo_documento: this.selectedTipo || undefined,
      fecha_desde: this.fechaDesde || undefined,
      fecha_hasta: this.fechaHasta || undefined
    };

    let obs;
    if (this.isMyDocuments) {
      obs = this.documentsService.getDocuments('me', params);
    } else if (this.idPacienteParam) {
      obs = this.documentsService.getPatientDocuments(this.idPacienteParam, params);
    } else {
      obs = this.documentsService.getDocuments('tenant', params);
    }

    obs.subscribe({
      error: () => this.showFeedback('Error al cargar los documentos clínicos.', 'error')
    });
  }

  onSearch(): void {
    this.loadDocuments(1);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedTipo = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.loadDocuments(1);
  }

  openDocument(doc: DocumentoResumen): void {
    if (this.isMyDocuments) {
      this.router.navigate(['/mis-documentos', doc.id_documento]);
    } else if (this.idPacienteParam) {
      this.router.navigate(['/documentos/paciente', this.idPacienteParam, 'documento', doc.id_documento]);
    } else {
      this.router.navigate(['/documentos', doc.id_documento]);
    }
  }

  get isStaff(): boolean {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'doctor';
  }

  showFeedback(message: string, type: 'success' | 'error'): void {
    this.actionFeedback.set({ message, type });
    setTimeout(() => this.actionFeedback.set(null), 4000);
  }
}