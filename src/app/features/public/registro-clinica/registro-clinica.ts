import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PublicService } from '../../../core/services/public.service';

@Component({
  selector: 'app-registro-clinica',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registro-clinica.html',
  styleUrls: ['./registro-clinica.css']
})
export class RegistroClinica {
  private readonly fb = inject(FormBuilder);
  private readonly publicService = inject(PublicService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    razon_social: ['', [Validators.maxLength(200)]],
    nit: ['', [Validators.maxLength(50)]],
    telefono: ['', [Validators.maxLength(30)]],
    direccion: ['', [Validators.maxLength(250)]],
    admin_nombres: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    admin_apellidos: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    admin_email: ['', [Validators.required, Validators.email]],
    admin_password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.publicService.registrarClinica(this.form.value).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set('¡Clínica y cuenta de administrador registradas exitosamente! Redirigiendo al inicio de sesión...');
        setTimeout(() => {
          this.router.navigate(['/login'], { queryParams: { email: res.administrador.correo, registered: 'true' } });
        }, 2000);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail || 'Ocurrió un error al registrar la clínica. Intente nuevamente.';
        this.errorMessage.set(detail);
      }
    });
  }
}
