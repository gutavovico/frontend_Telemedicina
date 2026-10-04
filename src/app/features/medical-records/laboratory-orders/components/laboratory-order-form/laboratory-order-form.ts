import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LaboratoryOrdersService } from '../../services/laboratory-orders.service';
import { ExamenOrdenRequest, ExamenOrdenResponse, OrdenLaboratorioCreateRequest, OrdenLaboratorioResponse, EstadoOrden } from '../../models/laboratory-order.models';

@Component({
  selector: 'app-laboratory-order-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './laboratory-order-form.html',
  styleUrl: './laboratory-order-form.css'
})
export class LaboratoryOrderForm implements OnInit {
  readonly service = inject(LaboratoryOrdersService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isEditing = signal(false);
  readonly orderId = signal<number | null>(null);

  readonly catalogo = this.service.catalogo;
  readonly selectedOrder = this.service.selectedOrder;

  form: FormGroup = this.fb.group({
    id_paciente: [null, [Validators.required]],
    id_cita: [null],
    examenes: this.fb.array([this.createExamenGroup()])
  });

  get examenes(): FormArray {
    return this.form.get('examenes') as FormArray;
  }

  createExamenGroup(): FormGroup {
    return this.fb.group({
      codigo: ['', [Validators.required]],
      indicaciones: ['']
    });
  }

  addExamen(): void {
    this.examenes.push(this.createExamenGroup());
  }

  removeExamen(index: number): void {
    if (this.examenes.length > 1) {
      this.examenes.removeAt(index);
    }
  }

  ngOnInit(): void {
    this.service.getCatalogo().subscribe();
    
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditing.set(true);
      this.orderId.set(Number(idParam));
      this.loadOrder(Number(idParam));
    }
  }

  loadOrder(id: number): void {
    this.service.getOrderById(id).subscribe({
      error: () => this.errorMessage.set('No se pudo cargar la orden.')
    });
  }

  getExamGroup(index: number): FormGroup {
    return this.examenes.at(index) as FormGroup;
  }

  getExamLabel(examen: FormGroup): string {
    const codigo = examen.get('codigo')?.value;
    if (!codigo) return 'Examen';
    const found = this.catalogo().find(e => e.codigo === codigo);
    return found ? `${codigo} - ${found.nombre}` : codigo;
  }

  onExamenChange(index: number): void {
    const examen = this.examenes.at(index);
    const codigo = examen.get('codigo')?.value?.toUpperCase();
    if (codigo) {
      examen.patchValue({ codigo }, { emitEvent: false });
    }
  }

  isExamenValid(index: number): boolean {
    const examen = this.examenes.at(index);
    const codigo = examen.get('codigo')?.value;
    if (!codigo) return false;
    return this.catalogo().some(e => e.codigo === codigo);
  }

  get duplicateExamenes(): boolean {
    const codigos = this.examenes.controls.map(c => c.get('codigo')?.value?.toUpperCase()).filter(Boolean);
    return new Set(codigos).size !== codigos.length;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.duplicateExamenes) {
      this.errorMessage.set('No se pueden repetir exámenes.');
      return;
    }
    if (this.examenes.controls.some(c => !this.isExamenValid(this.examenes.controls.indexOf(c)))) {
      this.errorMessage.set('Uno o más códigos de examen no existen en el catálogo.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const data: OrdenLaboratorioCreateRequest = {
      id_paciente: this.form.value.id_paciente,
      id_cita: this.form.value.id_cita || undefined,
      examenes: this.examenes.controls.map(c => ({
        codigo: c.get('codigo')?.value?.toUpperCase(),
        indicaciones: c.get('indicaciones')?.value || undefined
      })) as ExamenOrdenRequest[]
    };

    if (this.isEditing() && this.orderId()) {
      // Para edición, si está en borrador, se podría actualizar
      // Por simplicidad, solo permitimos firmar
    } else {
      this.service.createDraft(data).subscribe({
        next: (order) => {
          this.isLoading.set(false);
          this.successMessage.set('Orden creada en borrador. Puede firmarla para emitirla.');
          this.router.navigate(['/ordenes-laboratorio', order.id_orden]);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.error?.detail || 'Error al crear la orden.');
        }
      });
    }
  }

  async onFirmar(): Promise<void> {
    if (!this.orderId()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.service.firmarOrden(this.orderId()!).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Orden firmada y emitida correctamente. Se ha indexado en la HCE.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.detail || 'Error al firmar la orden.');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/ordenes-laboratorio']);
  }

  get isFirmada(): boolean {
    return this.selectedOrder()?.estado === 'FIRMADA';
  }

  get isBorrador(): boolean {
    return this.selectedOrder()?.estado === 'BORRADOR';
  }
}