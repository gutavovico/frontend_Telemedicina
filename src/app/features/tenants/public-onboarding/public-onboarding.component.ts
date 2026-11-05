import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PublicOnboardingService } from './services/public-onboarding.service';
import { PublicPlan, TrackingResponse } from './models/public-onboarding.model';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

@Component({
  selector: 'app-public-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './public-onboarding.component.html',
  styleUrls: ['./public-onboarding.component.css'],
})
export class PublicOnboardingComponent implements OnInit {
  private readonly fb: FormBuilder;
  private readonly onboardingService: PublicOnboardingService;

  activeTab = signal<'registro' | 'seguimiento'>('registro');

  onboardingForm!: FormGroup;
  selectedFiles: File[] = [];

  plans = signal<PublicPlan[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Éxito de solicitud de alta
  successTrackingCode = signal<string | null>(null);

  // Consulta de seguimiento
  trackingInput = signal<string>('');
  trackingLoading = signal<boolean>(false);
  trackingResult = signal<TrackingResponse | null>(null);
  trackingError = signal<string | null>(null);

  constructor(fb?: FormBuilder, onboardingService?: PublicOnboardingService) {
    this.fb = fb ?? inject(FormBuilder);
    this.onboardingService = onboardingService ?? inject(PublicOnboardingService);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadPlans();
  }

  initForm(): void {
    this.onboardingForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      razon_social: ['', [Validators.maxLength(200)]],
      nit: ['', [Validators.required, Validators.maxLength(50)]],
      correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      telefono: ['', [Validators.maxLength(30)]],
      direccion: ['', [Validators.maxLength(250)]],
      responsable_nombre: ['', [Validators.required, Validators.maxLength(150)]],
      responsable_correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      responsable_telefono: ['', [Validators.maxLength(30)]],
      plan_version_id: [null as number | null],
    });
  }

  loadPlans(): void {
    this.onboardingService.getPublicPlans().subscribe({
      next: (data) => {
        this.plans.set(data);
        if (data.length > 0 && !this.onboardingForm.get('plan_version_id')?.value) {
          this.onboardingForm.patchValue({ plan_version_id: data[0].id_plan_version });
        }
      },
      error: () => {
        // Fallback si no hay endpoint de planes disponible
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.errorMessage.set(null);
    const newFiles: File[] = Array.from(input.files);

    for (const file of newFiles) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        this.errorMessage.set(
          `Archivo '${file.name}' no permitido. Solo se aceptan formatos PDF, JPG y PNG.`,
        );
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        this.errorMessage.set(
          `Archivo '${file.name}' excede el límite de 10 MB permitido.`,
        );
        return;
      }
    }

    this.selectedFiles = [...this.selectedFiles, ...newFiles];
    input.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  submitOnboarding(): void {
    if (this.onboardingForm.invalid) {
      this.onboardingForm.markAllAsTouched();
      this.errorMessage.set('Por favor, revise los campos requeridos en el formulario.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const formData = new FormData();
    const val = this.onboardingForm.value;

    formData.append('nombre', val.nombre.trim());
    if (val.razon_social) formData.append('razon_social', val.razon_social.trim());
    formData.append('nit', val.nit.trim());
    formData.append('correo', val.correo.trim());
    if (val.telefono) formData.append('telefono', val.telefono.trim());
    if (val.direccion) formData.append('direccion', val.direccion.trim());
    formData.append('responsable_nombre', val.responsable_nombre.trim());
    formData.append('responsable_correo', val.responsable_correo.trim());
    if (val.responsable_telefono) formData.append('responsable_telefono', val.responsable_telefono.trim());
    if (val.plan_version_id !== null && val.plan_version_id !== undefined) {
      formData.append('plan_version_id', String(val.plan_version_id));
    }

    for (const file of this.selectedFiles) {
      formData.append('documentos', file, file.name);
    }

    this.onboardingService.submitOnboardingRequest(formData).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successTrackingCode.set(res.tracking_code);
        this.onboardingForm.reset();
        this.selectedFiles = [];
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.errorMessage.set(detail);
        } else if (Array.isArray(detail)) {
          this.errorMessage.set(detail.map((e: any) => e.msg || e.detail).join(', '));
        } else {
          this.errorMessage.set('Ocurrió un error al enviar la solicitud. Intente nuevamente.');
        }
      },
    });
  }

  limite(value: number | null): string {
    return value === null ? 'Sin límite' : String(value);
  }

  buscarSeguimiento(): void {
    const code = this.trackingInput().trim();
    if (!code) {
      this.trackingError.set('Ingrese el código de seguimiento');
      return;
    }

    this.trackingLoading.set(true);
    this.trackingError.set(null);
    this.trackingResult.set(null);

    this.onboardingService.getTrackingStatus(code).subscribe({
      next: (res) => {
        this.trackingResult.set(res);
        this.trackingLoading.set(false);
      },
      error: (err) => {
        this.trackingLoading.set(false);
        if (err.status === 404) {
          this.trackingError.set('No se encontró ninguna solicitud con ese código de seguimiento.');
        } else {
          this.trackingError.set(err?.error?.detail || 'Error al consultar el seguimiento.');
        }
      },
    });
  }

  cambiarTab(tab: 'registro' | 'seguimiento'): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
  }
}

