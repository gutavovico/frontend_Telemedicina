import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EspecialidadResponse, MedicoCreate, MedicoResponse, MedicoUpdate } from '../../../core/models/medico.models';
import { MedicoService } from '../../../core/services/medico.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-medico-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './medico-form.html',
  styleUrl: './medico-form.css'
})
export class MedicoForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly medicoService = inject(MedicoService);
  private readonly authService = inject(AuthService);

  /** Perfil médico existente: si está presente el formulario opera en modo edición. */
  readonly medico = input<MedicoResponse | null>(null);

  /** Usuario destino en modo creación (por defecto, el usuario autenticado). */
  readonly idUsuario = input<number | null>(null);

  /** Especialidades disponibles (catálogo), para el modo creación. */
  readonly especialidades = input<EspecialidadResponse[]>([]);

  /** Se emite con el perfil guardado (creado o actualizado). */
  readonly saved = output<MedicoResponse>();

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  /** Ids de especialidades seleccionadas (orden de selección: la primera será la principal). */
  readonly especialidadesSeleccionadas = signal<number[]>([]);

  readonly esEdicion = computed(() => this.medico() !== null);

  readonly medicoForm: FormGroup = this.fb.group({
    matricula_profesional: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(30)]],
    descripcion_profesional: ['', [Validators.maxLength(2000)]],
    experiencia: ['', [Validators.maxLength(2000)]],
    foto_perfil: ['', [Validators.maxLength(500)]]
  });

  ngOnInit(): void {
    // Precargar valores si llega un perfil para editar
    const perfil = this.medico();
    if (perfil) {
      this.medicoForm.patchValue({
        matricula_profesional: perfil.matricula_profesional,
        descripcion_profesional: perfil.descripcion_profesional ?? '',
        experiencia: perfil.experiencia ?? '',
        foto_perfil: perfil.foto_perfil ?? ''
      });
    }
  }

  toggleEspecialidad(idEspecialidad: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.especialidadesSeleccionadas.update(ids => {
      if (checked) {
        return [...ids, idEspecialidad];
      }
      return ids.filter(id => id !== idEspecialidad);
    });
  }

  estaSeleccionada(idEspecialidad: number): boolean {
    return this.especialidadesSeleccionadas().includes(idEspecialidad);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.medicoForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.medicoForm.invalid) {
      this.medicoForm.markAllAsTouched();
      return;
    }

    if (!this.esEdicion() && this.especialidadesSeleccionadas().length === 0) {
      this.errorMessage.set('Selecciona al menos una especialidad (la primera quedará como principal).');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formVal = this.medicoForm.value;

    if (this.esEdicion()) {
      const perfil = this.medico()!;
      const payload: MedicoUpdate = {
        matricula_profesional: formVal.matricula_profesional.trim(),
        descripcion_profesional: formVal.descripcion_profesional?.trim() || undefined,
        experiencia: formVal.experiencia?.trim() || undefined,
        foto_perfil: formVal.foto_perfil?.trim() || undefined
      };

      this.medicoService.actualizarMedico(perfil.id_medico, payload).subscribe({
        next: (medico) => {
          this.isLoading.set(false);
          this.successMessage.set('Perfil profesional actualizado exitosamente.');
          this.saved.emit(medico);
        },
        error: (err) => this.handleError(err)
      });
    } else {
      const targetUsuario = this.idUsuario() ?? this.authService.currentUser()?.id_usuario;
      if (!targetUsuario) {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo identificar el usuario destino del perfil médico.');
        return;
      }

      const payload: MedicoCreate = {
        id_usuario: targetUsuario,
        matricula_profesional: formVal.matricula_profesional.trim(),
        descripcion_profesional: formVal.descripcion_profesional?.trim() || undefined,
        experiencia: formVal.experiencia?.trim() || undefined,
        foto_perfil: formVal.foto_perfil?.trim() || undefined,
        especialidades: this.especialidadesSeleccionadas()
      };

      this.medicoService.crearMedico(payload).subscribe({
        next: (medico) => {
          this.isLoading.set(false);
          this.successMessage.set('Perfil profesional creado exitosamente.');
          this.saved.emit(medico);
        },
        error: (err) => this.handleError(err)
      });
    }
  }

  private handleError(err: any): void {
    this.isLoading.set(false);
    let detail = err.error?.detail;
    if (Array.isArray(detail)) {
      detail = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    }
    this.errorMessage.set(
      detail || 'Ocurrió un error al guardar el perfil profesional. Verifica los datos e intenta nuevamente.'
    );
  }
}
