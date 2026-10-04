import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly showPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly resetMessage = signal<string | null>(null);
  readonly expiredMessage = signal<string | null>(null);

  private returnUrl = '/';

  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false]
  });

  ngOnInit(): void {
    // Check for returnUrl in query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

    // Check if user was just registered
    if (this.route.snapshot.queryParams['registered'] === 'true') {
      this.successMessage.set('¡Cuenta creada exitosamente! Por favor inicia sesión.');
    }

    // Contraseña restablecida correctamente (CU23)
    if (this.route.snapshot.queryParams['reset'] === 'true') {
      this.resetMessage.set('Tu contraseña fue actualizada. Inicia sesión con la nueva contraseña.');
    }

    // Sesión cerrada por inactividad (CU23)
    if (this.route.snapshot.queryParams['expired'] === 'true') {
      this.expiredMessage.set('Tu sesión expiró por inactividad. Inicia sesión nuevamente para continuar.');
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.resetMessage.set(null);
    this.expiredMessage.set(null);

    const { email, password, rememberMe } = this.loginForm.value;

    this.authService.login(email, password, rememberMe).subscribe({
      next: (tenantContext) => {
        this.isLoading.set(false);
        if (this.returnUrl && this.returnUrl !== '/') {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.authService.redirectByRole(tenantContext);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        let detail = err.error?.detail;
        if (Array.isArray(detail)) {
          detail = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
        this.errorMessage.set(detail || 'Correo o contraseña incorrectos. Por favor intenta de nuevo.');
      }
    });
  }
}
