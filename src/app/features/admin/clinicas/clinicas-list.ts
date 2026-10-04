import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClinicasService } from '../../../core/services/clinicas.service';
import { PublicService } from '../../../core/services/public.service';
import { ClinicaItem, ClinicaRegistroRequest } from '../../../core/models/tenant.models';

@Component({
  selector: 'app-clinicas-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clinicas-list.html',
  styleUrls: ['./clinicas-list.css']
})
export class ClinicasList implements OnInit {
  private readonly clinicasService = inject(ClinicasService);
  private readonly publicService = inject(PublicService);

  readonly clinicas = signal<ClinicaItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly perPage = signal(20);
  readonly filterEstado = signal<string>('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Modal de Crear Clínica
  readonly showCreateModal = signal(false);
  readonly isCreating = signal(false);
  readonly createError = signal<string | null>(null);

  nuevaClinica: ClinicaRegistroRequest = {
    nombre: '',
    razon_social: '',
    nit: '',
    telefono: '',
    direccion: '',
    admin_nombres: '',
    admin_apellidos: '',
    admin_email: '',
    admin_password: ''
  };

  ngOnInit(): void {
    this.cargarClinicas();
  }

  cargarClinicas(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const estadoParam = this.filterEstado() || undefined;
    this.clinicasService.listClinicas(estadoParam, this.page(), this.perPage()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.clinicas.set(res.items);
        this.total.set(res.total);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || 'Error al cargar la lista de clínicas.');
      }
    });
  }

  abrirModalCrear(): void {
    this.nuevaClinica = {
      nombre: '',
      razon_social: '',
      nit: '',
      telefono: '',
      direccion: '',
      admin_nombres: '',
      admin_apellidos: '',
      admin_email: '',
      admin_password: ''
    };
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  cerrarModalCrear(): void {
    this.showCreateModal.set(false);
    this.createError.set(null);
  }

  guardarNuevaClinica(): void {
    if (!this.nuevaClinica.nombre || !this.nuevaClinica.admin_email || !this.nuevaClinica.admin_password || !this.nuevaClinica.admin_nombres || !this.nuevaClinica.admin_apellidos) {
      this.createError.set('Por favor completa todos los campos obligatorios (*).');
      return;
    }

    this.isCreating.set(true);
    this.createError.set(null);

    this.publicService.registrarClinica(this.nuevaClinica).subscribe({
      next: (res) => {
        this.isCreating.set(false);
        this.cerrarModalCrear();
        this.successMessage.set(`Clínica "${res.clinica.nombre}" creada exitosamente.`);
        setTimeout(() => this.successMessage.set(null), 4000);
        this.cargarClinicas();
      },
      error: (err) => {
        this.isCreating.set(false);
        this.createError.set(err?.error?.detail || 'Error al registrar la clínica.');
      }
    });
  }

  cambiarEstado(clinica: ClinicaItem, nuevoEstado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO'): void {
    if (!confirm(`¿Estás seguro de cambiar el estado de "${clinica.nombre}" a ${nuevoEstado}?`)) {
      return;
    }

    this.isLoading.set(true);
    this.clinicasService.updateEstado(clinica.clinica_id, nuevoEstado).subscribe({
      next: () => {
        this.successMessage.set(`Estado de "${clinica.nombre}" actualizado a ${nuevoEstado}.`);
        setTimeout(() => this.successMessage.set(null), 3000);
        this.cargarClinicas();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || 'Error al actualizar estado.');
      }
    });
  }
}
