import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Role, RoleCreate, RoleUpdate } from '../../../../core/models/role.models';

export type RoleFormMode = 'create' | 'edit';

export interface RoleFormSubmitEvent {
  mode: RoleFormMode;
  payload: RoleCreate | RoleUpdate;
}

const whitespaceValidator = () => (control: { value: string }) => {
  return control.value.trim().length > 0 ? null : { whitespace: true };
};

@Component({
  selector: 'app-role-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-form.html',
  styleUrl: './role-form.css'
})
export class RoleForm {
  private readonly fb = inject(FormBuilder);

  readonly mode = input<RoleFormMode>('create');
  readonly role = input<Role | null>(null);
  readonly visible = input<boolean>(false);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);

  readonly cancel = output<void>();
  readonly submitted = output<RoleFormSubmitEvent>();

  readonly title = computed(() =>
    this.mode() === 'create' ? 'Nuevo rol' : 'Editar rol'
  );

  readonly submitLabel = computed(() =>
    this.submitting()
      ? this.mode() === 'create'
        ? 'Creando rol...'
        : 'Guardando cambios...'
      : this.mode() === 'create'
        ? 'Crear rol'
        : 'Guardar cambios'
  );

  readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control('', {
      validators: [Validators.required, whitespaceValidator()]
    }),
    descripcion: this.fb.nonNullable.control('')
  });

  constructor() {
    effect(() => {
      const mode = this.mode();
      const role = this.role();

      if (mode === 'create') {
        this.form.reset(
          {
            nombre: '',
            descripcion: ''
          },
          { emitEvent: false }
        );
      } else if (role) {
        this.form.reset(
          {
            nombre: role.nombre ?? '',
            descripcion: role.descripcion ?? ''
          },
          { emitEvent: false }
        );
      } else {
        this.form.reset(
          {
            nombre: '',
            descripcion: ''
          },
          { emitEvent: false }
        );
      }
    });
  }

  close(): void {
    if (!this.submitting()) {
      this.cancel.emit();
    }
  }

  isFieldInvalid(fieldName: 'nombre' | 'descripcion'): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      nombre: value.nombre.trim(),
      descripcion: value.descripcion.trim() ? value.descripcion.trim() : null
    };

    if (this.mode() === 'create') {
      const createPayload: RoleCreate = payload;
      this.submitted.emit({
        mode: 'create',
        payload: createPayload
      });
      return;
    }

    const updatePayload: RoleUpdate = payload;

    this.submitted.emit({
      mode: 'edit',
      payload: updatePayload
    });
  }
}
