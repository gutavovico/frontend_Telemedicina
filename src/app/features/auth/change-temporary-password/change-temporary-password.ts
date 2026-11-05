import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export const temporaryPasswordMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('nueva_password');
  const confirmation = control.get('confirmar_password');
  if (!password || !confirmation) return null;
  return password.value === confirmation.value ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-change-temporary-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-temporary-password.html',
})
export class ChangeTemporaryPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly showPassword = signal(false);
  readonly showConfirmation = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      nueva_password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar_password: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: temporaryPasswordMatchValidator },
  );

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  toggleConfirmation(): void {
    this.showConfirmation.update(value => !value);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && (control.dirty || control.touched));
  }

  hasMismatch(): boolean {
    return this.form.hasError('passwordMismatch');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .changeTemporaryPassword(value.nueva_password!, value.confirmar_password!)
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.authService.mustChangePassword.set(false);
          this.authService.clearTokens();
          this.router.navigate(['/login'], { queryParams: { changed: 'true' } });
        },
        error: (error) => {
          this.loading.set(false);
          const detail = error?.error?.detail;
          this.errorMessage.set(
            typeof detail === 'string'
              ? detail
              : 'No se pudo cambiar la contraseña. Intente nuevamente.',
          );
        },
      });
  }
}
