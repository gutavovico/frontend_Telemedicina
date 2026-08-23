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
import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest } from '../../../core/models/auth.models';

/**
 * Custom cross-field validator to check that password and confirmar_password match
 */
export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmar_password');

  if (!password || !confirmPassword) {
    return null;
  }

  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly registerForm: FormGroup = this.fb.group(
    {
      nombres: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      apellidos: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.maxLength(20)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar_password: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    },
    { validators: passwordMatchValidator }
  );

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(value => !value);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    const confirmField = this.registerForm.get('confirmar_password');
    return !!(
      this.registerForm.hasError('passwordMismatch') &&
      confirmField &&
      (confirmField.dirty || confirmField.touched)
    );
  }

  getPasswordStrength(): { level: number; label: string; color: string } {
    const pwd = this.registerForm.get('password')?.value || '';
    if (!pwd) return { level: 0, label: '', color: 'bg-outline-variant' };
    
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { level: 1, label: 'Débil', color: 'bg-error' };
    if (score === 2 || score === 3) return { level: 2, label: 'Media', color: 'bg-amber-500' };
    return { level: 3, label: 'Fuerte', color: 'bg-secondary' };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formVal = this.registerForm.value;
    const registerPayload: RegisterRequest = {
      nombres: formVal.nombres.trim(),
      apellidos: formVal.apellidos.trim(),
      correo: formVal.correo.trim().toLowerCase(),
      password: formVal.password,
      telefono: formVal.telefono ? formVal.telefono.trim() : undefined
    };

    this.authService.register(registerPayload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/login'], {
          queryParams: { registered: 'true' }
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        let detail = err.error?.detail;
        if (Array.isArray(detail)) {
          detail = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
        this.errorMessage.set(
          detail || 'Ocurrió un error al registrar la cuenta. Por favor verifica los datos ingresados.'
        );
      }
    });
  }
}
