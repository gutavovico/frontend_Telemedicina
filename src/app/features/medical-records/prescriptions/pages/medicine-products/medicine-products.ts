import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Footer } from '../../../../../shared/components/footer/footer';
import { Header } from '../../../../../shared/components/header/header';
import { Medicamento, MedicamentoCreateRequest } from '../../models/prescription.models';
import { PrescriptionsService } from '../../services/prescriptions.service';

@Component({
  selector: 'app-medicine-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Header, Footer],
  templateUrl: './medicine-products.html',
  styleUrl: './medicine-products.css',
})
export class MedicineProducts implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PrescriptionsService);

  readonly medicines = signal<Medicamento[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly isCreating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly createSuccess = signal<string | null>(null);
  readonly searchControl = this.fb.control('', { nonNullable: true });

  readonly createForm = this.fb.group({
    nombre: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    principio_activo: this.fb.control<string | null>(null, Validators.maxLength(200)),
    concentracion: this.fb.control<string | null>(null, Validators.maxLength(100)),
    forma_farmaceutica: this.fb.control<string | null>(null, Validators.maxLength(100)),
    descripcion: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    this.loadMedicines();
  }

  loadMedicines(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.service
      .searchMedicines({ query: this.searchControl.value.trim(), estado: 'ACTIVO', limit: 200 })
      .subscribe({
        next: (response) => {
          this.medicines.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.loadError.set(this.errorMessage(error, 'No se pudo cargar el catálogo.'));
        },
      });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.loadMedicines();
  }

  createMedicine(): void {
    this.createError.set(null);
    this.createSuccess.set(null);
    if (this.createForm.invalid || this.isCreating()) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    const payload: MedicamentoCreateRequest = {
      nombre: value.nombre.trim(),
      principio_activo: this.normalize(value.principio_activo),
      concentracion: this.normalize(value.concentracion),
      forma_farmaceutica: this.normalize(value.forma_farmaceutica),
      descripcion: this.normalize(value.descripcion),
    };
    if (!payload.nombre) {
      this.createForm.controls.nombre.setErrors({ required: true });
      return;
    }

    this.isCreating.set(true);
    this.service.createMedicine(payload).subscribe({
      next: (medicine) => {
        this.isCreating.set(false);
        this.createSuccess.set(`Producto “${medicine.nombre}” registrado.`);
        this.createForm.reset();
        this.loadMedicines();
      },
      error: (error: unknown) => {
        this.isCreating.set(false);
        this.createError.set(this.errorMessage(error, 'No se pudo registrar el producto.'));
      },
    });
  }

  private normalize(value: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return normalized || null;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (
      error instanceof HttpErrorResponse &&
      typeof error.error === 'object' &&
      error.error !== null
    ) {
      const detail = (error.error as { detail?: unknown }).detail;
      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }
    }
    return fallback;
  }
}
