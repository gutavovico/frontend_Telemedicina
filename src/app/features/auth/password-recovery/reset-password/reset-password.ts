import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

/**
 * Validador de coincidencia entre contraseña y confirmación.
 */
export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('nueva_password');
  const confirmPassword = control.get('confirmar_password');

  if (!password || !confirmPassword) {
    return null;
  }

  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly resetForm: FormGroup = this.fb.group(
    {
      correo: ['', [Validators.required, Validators.email]],
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      nueva_password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar_password: ['', [Validators.required]]
    },
    { validators: passwordMatchValidator }
  );

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(value => !value);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.resetForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    const confirmField = this.resetForm.get('confirmar_password');
    return !!(
      this.resetForm.hasError('passwordMismatch') &&
      confirmField &&
      (confirmField.dirty || confirmField.touched)
    );
  }

  getPasswordStrength(): { level: number; label: string; color: string } {
    const pwd = this.resetForm.get('nueva_password')?.value || '';
    if (!pwd) return { level: 0, label: '', color: 'bg-outline-variant' };

    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { level: 1, label: 'Débil', color: 'bg-error' };
    if (score === 2 || score === 3) return { level: 2, label: 'Media', color: 'bg-amber-500' };
    return { level: 3, label: 'Fuerte', color: 'bg-secondary' };
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formVal = this.resetForm.value;

    this.authService
      .resetPassword(
        formVal.correo.trim().toLowerCase(),
        formVal.codigo.trim(),
        formVal.nueva_password
      )
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/login'], {
            queryParams: { reset: 'true' }
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          let detail = err.error?.detail;
          if (Array.isArray(detail)) {
            detail = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
          }
          this.errorMessage.set(
            detail || 'No se pudo restablecer la contraseña. Verifica el código e intenta de nuevo.'
          );
        }
      });
  }
}