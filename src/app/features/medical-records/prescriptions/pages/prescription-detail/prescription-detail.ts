import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { RecetaResponse } from '../../models/prescription.models';
import { PrescriptionSheet } from '../../components/prescription-sheet/prescription-sheet';
import { CancelPrescriptionDialog } from '../../components/cancel-prescription-dialog/cancel-prescription-dialog';

@Component({
  selector: 'app-prescription-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    Header,
    Footer,
    PrescriptionSheet,
    CancelPrescriptionDialog,
  ],
  templateUrl: './prescription-detail.html',
  styleUrl: './prescription-detail.css',
})
export class PrescriptionDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PrescriptionsService);
  readonly authService = inject(AuthService);

  readonly receta = signal<RecetaResponse | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isDownloading = signal<boolean>(false);
  readonly downloadError = signal<string | null>(null);
  readonly downloadSuccess = signal<string | null>(null);
  readonly cancelOpen = signal<boolean>(false);

  // Descarga (CU16, hallazgo 2): la receta debe estar cargada y el rol debe ser
  // reconocido (admin/doctor/paciente). El paciente solo recibe del backend sus
  // propias recetas; el médico, las de su alcance; el admin, las de su clínica.
  // El contrato actual no expone permisos efectivos al frontend, por lo que la
  // interfaz aplica alcance por rol/recurso y el backend valida como autoridad
  // final el permiso granular `prescriptions:download` (403 se informa abajo).
  readonly canDownload = computed(() => {
    if (!this.receta()) {
      return false;
    }
    const role = this.authService.userRole();
    return role === 'admin' || role === 'doctor' || role === 'paciente';
  });

  // Anulación (CU16, hallazgo 2): solo receta emitida y no vencida; el médico
  // debe ser el emisor (receta.id_medico vs perfil médico confirmado) o el
  // usuario debe ser ADMIN real. Un médico distinto del emisor no ve el botón.
  // El backend conserva la autoridad final (`prescriptions:cancel`, 403/409).
  readonly canCancel = computed(() => {
    const receta = this.receta();
    if (!receta) {
      return false;
    }
    if (receta.estado !== 'EMITIDA' || receta.esta_vencida) {
      return false;
    }
    const role = this.authService.userRole();
    if (role === 'admin') {
      return true;
    }
    if (role === 'doctor') {
      const perfil = this.authService.perfilMedico();
      return perfil !== null && perfil.id_medico === receta.id_medico;
    }
    return false;
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.isLoading.set(false);
      this.errorMessage.set('Identificador de receta inválido.');
      return;
    }
    this.cargar(id);
  }

  cargar(id: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.service.getPrescription(id).subscribe({
      next: (res) => {
        this.receta.set(res);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.mensajeError(err));
      },
    });
  }

  recargar(): void {
    const receta = this.receta();
    if (receta) {
      this.cargar(receta.id_receta);
    } else {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (id) {
        this.cargar(id);
      }
    }
  }

  descargarPdf(): void {
    const receta = this.receta();
    if (!receta || this.isDownloading()) {
      return;
    }
    this.isDownloading.set(true);
    this.downloadError.set(null);
    this.downloadSuccess.set(null);
    this.service.downloadPdf(receta.id_receta).subscribe({
      next: (resp: HttpResponse<Blob>) => {
        const blob = resp.body;
        if (!blob) {
          this.isDownloading.set(false);
          this.downloadError.set('El servidor devolvió un archivo vacío.');
          return;
        }
        const filename = this.service.resolvePdfFilename(resp, `receta_${receta.folio}.pdf`);
        try {
          this.service.saveBlob(blob, filename);
          this.downloadSuccess.set(`PDF "${filename}" descargado. Es el documento legal.`);
        } catch {
          this.downloadError.set('No se pudo guardar el archivo.');
        } finally {
          this.isDownloading.set(false);
        }
      },
      error: (err: unknown) => {
        this.isDownloading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 403) {
          this.downloadError.set('No tiene permiso para descargar este PDF (403).');
        } else if (err instanceof HttpErrorResponse && err.status === 404) {
          this.downloadError.set('Receta no encontrada (404).');
        } else {
          this.downloadError.set('No se pudo descargar el PDF.');
        }
      },
    });
  }

  abrirAnulacion(): void {
    this.cancelOpen.set(true);
  }

  cerrarAnulacion(): void {
    this.cancelOpen.set(false);
  }

  alAnularConfirmada(actualizada: RecetaResponse): void {
    this.receta.set(actualizada);
    this.cancelOpen.set(false);
  }

  volverAlListado(): void {
    void this.router.navigate(['/recetas']);
  }

  private mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as unknown;
      if (typeof body === 'object' && body !== null && 'detail' in body) {
        const detail = (body as { detail: unknown }).detail;
        if (typeof detail === 'string' && detail.trim() !== '') {
          return detail;
        }
      }
      if (err.status === 404) {
        return 'Receta no encontrada.';
      }
      if (err.status === 403) {
        return 'No tiene permiso para ver esta receta.';
      }
      if (err.status === 401) {
        return 'Sesión vencida. Inicie sesión nuevamente.';
      }
    }
    return 'No se pudo cargar la receta.';
  }
}
