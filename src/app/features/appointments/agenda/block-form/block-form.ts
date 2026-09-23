import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BloqueoCreate, RolAgenda, ServicioAgenda } from '../medical-agenda.models';
import { fechaBolivia, limitesServicio } from '../medical-agenda.utils';

@Component({
  selector: 'app-agenda-block-form', standalone: true,
  imports: [ReactiveFormsModule, A11yModule],
  templateUrl: './block-form.html', styleUrl: '../medical-agenda.css'
})
export class AgendaBlockForm {
  readonly servicios = input.required<ServicioAgenda[]>();
  readonly rol = input.required<RolAgenda>();
  readonly medicoId = input.required<number>();
  readonly medicoNombre = input.required<string>();
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly cancel = output<void>();
  readonly submitted = output<BloqueoCreate>();
  readonly validationError = signal<string | null>(null);
  readonly selectedService = signal(0);
  readonly limites = computed(() => limitesServicio(this.servicios().find(s => s.id_servicio === this.selectedService())));
  readonly manana = fechaBolivia(1);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    id_servicio: [0, [Validators.required, Validators.min(1)]],
    fecha: [this.manana, Validators.required], hora_inicio: ['', Validators.required],
    hora_fin: ['', Validators.required], motivo: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      const primero = this.servicios().find(s => s.estado.toLowerCase() === 'activo');
      if (primero && !this.selectedService()) {
        this.form.controls.id_servicio.setValue(primero.id_servicio);
        this.changeService();
      }
    });
  }
  changeService(): void {
    this.selectedService.set(this.form.controls.id_servicio.value);
    this.form.patchValue({ hora_inicio: '', hora_fin: '' });
    this.validationError.set(null);
  }
  close(): void { if (!this.submitting()) this.cancel.emit(); }
  submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const limites = this.limites();
    let error: string | null = null;
    if (this.form.invalid || !value.motivo.trim()) error = 'Completa todos los campos y escribe el motivo.';
    else if (this.rol() === 'MEDICO' && value.fecha !== fechaBolivia(1)) error = 'Solo puedes solicitar un bloqueo para mañana (hora de Bolivia).';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(value.fecha) || Number.isNaN(Date.parse(value.fecha)) ||
      new Date(value.fecha).toISOString().slice(0, 10) !== value.fecha) error = 'Selecciona una fecha válida.';
    else if (!limites.includes(value.hora_inicio) || !limites.includes(value.hora_fin) || value.hora_inicio >= value.hora_fin) {
      error = 'Selecciona un inicio y un fin válidos; el fin debe ser posterior al inicio.';
    }
    this.validationError.set(error);
    if (error) return;
    this.submitted.emit({ ...value, hora_inicio: `${value.hora_inicio}:00`, hora_fin: `${value.hora_fin}:00`,
      motivo: value.motivo.trim(), ...(this.rol() === 'RECEPCION' ? { id_medico: this.medicoId() } : {}) });
  }
}
