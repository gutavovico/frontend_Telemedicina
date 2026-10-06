import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-recover',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './recover.html',
  styleUrl: './recover.css'
})
export class Recover {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly recoverForm: FormGroup = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    canal: ['email', [Validators.required]]
  });

  isFieldInvalid(fieldName: string): boolean {
    const field = this.recoverForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  onSubmit(): void {
    if (this.recoverForm.invalid) {
      this.recoverForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formVal = this.recoverForm.value;
    const correo = formVal.correo.trim().toLowerCase();
    const canal = formVal.canal;

    this.authService.requestPasswordReset(correo, canal).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Si el correo está registrado, recibirás un código de recuperación de 6 dígitos.');
        this.recoverForm.reset();
      },
      error: (err) => {
        this.isLoading.set(false);
        let detail = err.error?.detail;
        if (Array.isArray(detail)) {
          detail = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
        this.errorMessage.set(detail || 'Ocurrió un error al solicitar el código. Intenta de nuevo.');
      }
    });
  }
}