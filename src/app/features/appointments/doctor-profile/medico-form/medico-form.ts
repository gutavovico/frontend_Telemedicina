import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EspecialidadResponse, MedicoCreate, MedicoResponse, MedicoUpdate } from '../../../../core/models/medico.models';
import { RegisterRequest } from '../../../../core/models/auth.models';
import { MedicoService } from '../../../../core/services/medico.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-medico-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './medico-form.html',
  styleUrl: './medico-form.css'
})
export class MedicoForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly medicoService = inject(MedicoService);
  readonly authService = inject(AuthService);

  /** Perfil médico existente: si está presente el formulario opera en modo edición. */
  readonly medico = input<MedicoResponse | null>(null);

  /** Usuario destino en modo creación (por defecto, el usuario autenticado). */
  readonly idUsuario = input<number | null>(null);

  /** Especialidades disponibles (catálogo), para el modo creación. */
  readonly especialidades = input<EspecialidadResponse[]>([]);

  /**
   * CU04: cuando es true, el formulario crea el perfil profesional del usuario
   * autenticado (oculta la sección de cuenta de acceso y no crea usuarios nuevos).
   */
  readonly autoRegistro = input(false);

  /** Se emite con el perfil guardado (creado o actualizado). */
  readonly saved = output<MedicoResponse>();

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  /** Ids de especialidades seleccionadas (orden de selección: la primera será la principal). */
  readonly especialidadesSeleccionadas = signal<number[]>([]);

  readonly esEdicion = computed(() => this.medico() !== null);

  readonly medicoForm: FormGroup = this.fb.group({
    // Campos de cuenta de usuario (solo creación Admin nuevo doctor)
    nombres: ['', [Validators.minLength(2), Validators.maxLength(100)]],
    apellidos: ['', [Validators.minLength(2), Validators.maxLength(100)]],
    correo: ['', [Validators.email]],
    password: ['', [Validators.minLength(6), Validators.maxLength(100)]],
    telefono: ['', [Validators.maxLength(20)]],

    // Campos profesionales
    matricula_profesional: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(30)]],
    descripcion_profesional: ['', [Validators.maxLength(2000)]],
    experiencia: ['', [Validators.maxLength(2000)]],
    foto_perfil: ['', [Validators.maxLength(500)]]
  });

  ngOnInit(): void {
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

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
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
    } else if (this.autoRegistro()) {
      // CU04 auto-registro: crear el perfil profesional del usuario autenticado
      const currentUser = this.authService.currentUser();
      if (!currentUser?.id_usuario) {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo identificar tu cuenta de usuario. Inicia sesión nuevamente.');
        return;
      }

      const medicoPayload: MedicoCreate = {
        id_usuario: currentUser.id_usuario,
        matricula_profesional: formVal.matricula_profesional.trim(),
        descripcion_profesional: formVal.descripcion_profesional?.trim() || undefined,
        experiencia: formVal.experiencia?.trim() || undefined,
        foto_perfil: formVal.foto_perfil?.trim() || undefined,
        especialidades: this.especialidadesSeleccionadas()
      };

      this.medicoService.crearMedico(medicoPayload).subscribe({
        next: (medico) => {
          this.isLoading.set(false);
          this.successMessage.set('Perfil profesional creado exitosamente.');
          this.authService.fetchPerfilMedico();
          this.saved.emit(medico);
        },
        error: (err) => this.handleError(err)
      });
    } else {
      // Modo creación Admin: registro completo de cuenta de usuario + perfil médico
      const nombres = formVal.nombres?.trim();
      const apellidos = formVal.apellidos?.trim();
      const correo = formVal.correo?.trim();
      const password = formVal.password;

      if (!nombres || nombres.length < 2) {
        this.isLoading.set(false);
        this.errorMessage.set('Ingresa los nombres del médico (mínimo 2 caracteres).');
        return;
      }
      if (!apellidos || apellidos.length < 2) {
        this.isLoading.set(false);
        this.errorMessage.set('Ingresa los apellidos del médico (mínimo 2 caracteres).');
        return;
      }
      if (!correo || !correo.includes('@')) {
        this.isLoading.set(false);
        this.errorMessage.set('Ingresa un correo electrónico válido para el médico.');
        return;
      }
      if (!password || password.length < 6) {
        this.isLoading.set(false);
        this.errorMessage.set('Ingresa una contraseña segura de al menos 6 caracteres.');
        return;
      }

      const userPayload: RegisterRequest = {
        nombres,
        apellidos,
        correo,
        password,
        telefono: formVal.telefono?.trim() || undefined
      };

      // Si el correo coincide con el usuario actualmente logueado y este no tiene perfil médico:
      const currentUser = this.authService.currentUser();
      if (currentUser && currentUser.correo.toLowerCase() === correo.toLowerCase()) {
        const medicoPayload: MedicoCreate = {
          id_usuario: currentUser.id_usuario,
          matricula_profesional: formVal.matricula_profesional.trim(),
          descripcion_profesional: formVal.descripcion_profesional?.trim() || undefined,
          experiencia: formVal.experiencia?.trim() || undefined,
          foto_perfil: formVal.foto_perfil?.trim() || undefined,
          especialidades: this.especialidadesSeleccionadas()
        };

        this.medicoService.crearMedico(medicoPayload).subscribe({
          next: (medico) => {
            this.isLoading.set(false);
            this.successMessage.set('Perfil profesional creado exitosamente.');
            this.saved.emit(medico);
          },
          error: (err) => this.handleError(err)
        });
        return;
      }

      // De lo contrario, crea la cuenta de usuario y luego el perfil médico:
      this.authService.register(userPayload).subscribe({
        next: (usuarioCreado) => {
          const medicoPayload: MedicoCreate = {
            id_usuario: usuarioCreado.id_usuario,
            matricula_profesional: formVal.matricula_profesional.trim(),
            descripcion_profesional: formVal.descripcion_profesional?.trim() || undefined,
            experiencia: formVal.experiencia?.trim() || undefined,
            foto_perfil: formVal.foto_perfil?.trim() || undefined,
            especialidades: this.especialidadesSeleccionadas()
          };

          this.medicoService.crearMedico(medicoPayload).subscribe({
            next: (medico) => {
              this.isLoading.set(false);
              this.successMessage.set(`Doctor ${usuarioCreado.nombres} ${usuarioCreado.apellidos} registrado exitosamente.`);
              this.saved.emit(medico);
            },
            error: (err) => this.handleError(err)
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          let detail = err.error?.detail;
          if (Array.isArray(detail)) {
            detail = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
          }
          if (err.status === 409 || (typeof detail === 'string' && detail.toLowerCase().includes('registrado'))) {
            this.errorMessage.set(`El correo ${correo} ya se encuentra registrado.`);
          } else {
            this.errorMessage.set(detail || 'No se pudo crear la cuenta del médico.');
          }
        }
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
