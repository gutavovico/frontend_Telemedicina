import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { AdminUser, AdminUserCreate, AdminUserUpdate, UserRole } from '../../../core/models/user.models';

export type UserFormMode = 'create' | 'edit';

export interface UserFormSubmitEvent {
  mode: UserFormMode;
  payload: AdminUserCreate | AdminUserUpdate;
}

export const userPasswordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (!password || !confirmPassword) {
    return null;
  }

  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-user-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css'
})
export class UserForm {
  private readonly fb = inject(FormBuilder);

  readonly mode = input<UserFormMode>('create');
  readonly user = input<AdminUser | null>(null);
  readonly roles = input<UserRole[]>([]);
  readonly visible = input<boolean>(false);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);

  readonly cancel = output<void>();
  readonly submitted = output<UserFormSubmitEvent>();

  readonly title = computed(() =>
    this.mode() === 'create' ? 'Nuevo usuario' : 'Editar usuario'
  );

  readonly submitLabel = computed(() =>
    this.submitting()
      ? this.mode() === 'create'
        ? 'Creando usuario...'
        : 'Guardando cambios...'
      : this.mode() === 'create'
        ? 'Crear usuario'
        : 'Guardar cambios'
  );

  readonly isPasswordRequired = computed(() => this.mode() === 'create');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly form = this.fb.group(
    {
      nombres: this.fb.nonNullable.control('', { validators: [Validators.required] }),
      apellidos: this.fb.nonNullable.control('', { validators: [Validators.required] }),
      correo: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.email] }),
      telefono: this.fb.nonNullable.control(''),
      password: this.fb.nonNullable.control(''),
      confirmPassword: this.fb.nonNullable.control(''),
      id_rol: new FormControl<number | null>(null, { validators: [Validators.required] }),
      id_clinica: new FormControl<number | null>(null),
      notificaciones_push: this.fb.nonNullable.control(false),
      notificaciones_email: this.fb.nonNullable.control(true),
      notificaciones_sms: this.fb.nonNullable.control(false)
    },
    { validators: userPasswordMatchValidator }
  );

  constructor() {
    effect(() => {
      const mode = this.mode();
      const user = this.user();
      const passwordControl = this.form.get('password');
      const confirmControl = this.form.get('confirmPassword');

      this.showPassword.set(false);
      this.showConfirmPassword.set(false);

      if (mode === 'create') {
        passwordControl?.setValidators([Validators.required]);
        confirmControl?.setValidators([Validators.required]);
        this.form.reset({
          nombres: '',
          apellidos: '',
          correo: '',
          telefono: '',
          password: '',
          confirmPassword: '',
          id_rol: null,
          id_clinica: null,
          notificaciones_push: false,
          notificaciones_email: true,
          notificaciones_sms: false
        }, { emitEvent: false });
      } else if (user) {
        passwordControl?.clearValidators();
        confirmControl?.clearValidators();
        this.form.reset({
          nombres: user.nombres ?? '',
          apellidos: user.apellidos ?? '',
          correo: user.correo ?? '',
          telefono: user.telefono ?? '',
          password: '',
          confirmPassword: '',
          id_rol: user.id_rol ?? null,
          id_clinica: user.id_clinica ?? null,
          notificaciones_push: user.notificaciones_push ?? false,
          notificaciones_email: user.notificaciones_email ?? false,
          notificaciones_sms: user.notificaciones_sms ?? false
        }, { emitEvent: false });
      } else {
        passwordControl?.clearValidators();
        confirmControl?.clearValidators();
        this.form.reset({
          nombres: '',
          apellidos: '',
          correo: '',
          telefono: '',
          password: '',
          confirmPassword: '',
          id_rol: null,
          id_clinica: null,
          notificaciones_push: false,
          notificaciones_email: false,
          notificaciones_sms: false
        }, { emitEvent: false });
      }

      passwordControl?.updateValueAndValidity({ emitEvent: false });
      confirmControl?.updateValueAndValidity({ emitEvent: false });
      this.form.updateValueAndValidity({ emitEvent: false });
    });
  }

  close(): void {
    if (!this.submitting()) {
      this.cancel.emit();
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    const confirmField = this.form.get('confirmPassword');
    return !!(
      this.form.hasError('passwordMismatch') &&
      confirmField &&
      (confirmField.dirty || confirmField.touched)
    );
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const basePayload = {
      nombres: value.nombres.trim(),
      apellidos: value.apellidos.trim(),
      correo: value.correo.trim().toLowerCase(),
      telefono: value.telefono?.trim() || null,
      id_rol: Number(value.id_rol),
      id_clinica: value.id_clinica === null || value.id_clinica === undefined
        ? null
        : Number(value.id_clinica),
      notificaciones_push: !!value.notificaciones_push,
      notificaciones_email: !!value.notificaciones_email,
      notificaciones_sms: !!value.notificaciones_sms
    };

    if (this.mode() === 'create') {
      const payload: AdminUserCreate = {
        ...basePayload,
        password: value.password ?? ''
      };
      this.submitted.emit({ mode: 'create', payload });
      return;
    }

    const payload: AdminUserUpdate = {
      ...basePayload
    };

    const password = value.password?.trim();
    if (password) {
      payload.password = password;
    }

    this.submitted.emit({ mode: 'edit', payload });
  }
}
