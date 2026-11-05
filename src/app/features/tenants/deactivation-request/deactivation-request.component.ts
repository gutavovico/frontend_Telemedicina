import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PublicOnboardingService } from '../public-onboarding/services/public-onboarding.service';

@Component({
  selector: 'app-deactivation-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './deactivation-request.component.html',
  styleUrls: ['./deactivation-request.component.css'],
})
export class DeactivationRequestComponent {
  private readonly fb: FormBuilder;
  private readonly onboardingService: PublicOnboardingService;

  deactForm!: FormGroup;
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  confirmedCheck = signal<boolean>(false);

  constructor(fb?: FormBuilder, onboardingService?: PublicOnboardingService) {
    this.fb = fb ?? inject(FormBuilder);
    this.onboardingService = onboardingService ?? inject(PublicOnboardingService);
    this.initForm();
  }

  initForm(): void {
    this.deactForm = this.fb.group({
      motivo: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      confirmacion: [false, [Validators.requiredTrue]],
    });
  }

  submitDeactivation(): void {
    if (this.deactForm.invalid) {
      this.deactForm.markAllAsTouched();
      this.errorMessage.set('Por favor, detalle el motivo formal y acepte la confirmación de retención de datos.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const motivo = this.deactForm.get('motivo')?.value;

    this.onboardingService.submitDeactivationRequest({ motivo }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set(
          `${res.message} (ID de trámite: ${res.id_deactivation})`,
        );
        this.deactForm.reset();
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail || 'Error al procesar la solicitud de baja.';
        this.errorMessage.set(detail);
      },
    });
  }
}

