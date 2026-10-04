import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AsignacionEspecialidad,
  EspecialidadCreate,
  EspecialidadResponse,
  MedicoResponse
} from '../../../../core/models/medico.models';
import { MedicoService } from '../../../../core/services/medico.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MedicoForm } from '../medico-form/medico-form';
import { Header } from '../../../../shared/components/header/header';

@Component({
  selector: 'app-medico-detail',
  imports: [CommonModule, FormsModule, RouterLink, MedicoForm, Header],
  templateUrl: './medico-detail.html',
  styleUrl: './medico-detail.css'
})
export class MedicoDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly medicoService = inject(MedicoService);
  readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly accionMessage = signal<string | null>(null);
  readonly tipoMensaje = signal<'success' | 'error' | null>(null);

  readonly medico = signal<MedicoResponse | null>(null);
  readonly especialidades = signal<EspecialidadResponse[]>([]);

  readonly modoEdicion = signal(false);
  readonly esMiPerfil = signal(false);
  readonly sinPerfil = signal(false);

  // Permisos: el propietario y el administrador pueden editar o gestionar el perfil
  readonly esPropietario = computed(() => {
    if (this.esMiPerfil()) return true;
    const medico = this.medico();
    const currentUser = this.authService.currentUser();
    if (!medico || !currentUser) return false;
    return medico.id_usuario === currentUser.id_usuario;
  });

  readonly puedeGestionar = computed(() => {
    return this.authService.isAdmin() || this.esPropietario();
  });

  // Asignación de especialidad
  readonly nuevaEspecialidadId = signal<number | null>(null);
  readonly nuevaEsPrincipal = signal(false);
  readonly procesandoAccion = signal(false);

  // Creación inline de especialidad
  readonly mostrarFormEspecialidad = signal(false);
  nuevaEspNombre = '';
  nuevaEspDescripcion = '';
  readonly guardandoEspecialidad = signal(false);
  readonly errorEspecialidad = signal<string | null>(null);

  readonly nombreCompleto = computed(() => {
    const medico = this.medico();
    const usuario = medico?.usuario;
    if (usuario?.nombres || usuario?.apellidos) {
      return `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim();
    }
    return medico ? `Médico #${medico.id_medico}` : '';
  });

  readonly iniciales = computed(() => {
    const usuario = this.medico()?.usuario;
    if (usuario?.nombres && usuario?.apellidos) {
      return (
        usuario.nombres.trim().charAt(0).toUpperCase() +
        usuario.apellidos.trim().charAt(0).toUpperCase()
      );
    }
    return 'MD';
  });

  readonly foto = computed(() => {
    const medico = this.medico();
    return medico?.foto_perfil || medico?.usuario?.foto_perfil || null;
  });

  /** Especialidades del catálogo que el médico aún no tiene asignadas. */
  readonly especialidadesDisponibles = computed(() => {
    const medico = this.medico();
    if (!medico) return [];
    const asignadas = new Set(medico.especialidades.map(e => e.id_especialidad));
    return this.especialidades().filter(e => !asignadas.has(e.id_especialidad));
  });

  readonly hayDisponibles = computed(() => this.especialidadesDisponibles().length > 0);

  ngOnInit(): void {
    // El modo "mi perfil" se define por route data (ruta /mi-perfil-medico)
    this.esMiPerfil.set(this.route.snapshot.data['miPerfil'] === true);
    this.cargarEspecialidades();

    if (this.esMiPerfil()) {
      this.cargarMiPerfil();
    } else {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!id || Number.isNaN(id)) {
        this.isLoading.set(false);
        this.errorMessage.set('Identificador de médico inválido.');
        return;
      }
      this.cargarMedico(id);
    }
  }

  cargarEspecialidades(): void {
    this.medicoService.listarEspecialidades().subscribe({
      next: (especialidades) => this.especialidades.set(especialidades),
      error: () => this.mostrarMensaje('error', 'No se pudo cargar el catálogo de especialidades.')
    });
  }

  cargarMedico(id: number): void {
    this.medicoService.obtenerMedico(id).subscribe({
      next: (medico) => {
        this.medico.set(medico);
        this.isLoading.set(false);
        // CU04: ver un perfil ajeno es exclusivo del administrador;
        // cualquier otro usuario fuera del caso de uso sale del módulo
        if (!this.authService.isAdmin() && !this.esPropietario()) {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 404) {
          this.errorMessage.set('El médico solicitado no existe.');
        } else {
          this.errorMessage.set('No se pudo cargar el perfil del médico.');
        }
      }
    });
  }

  cargarMiPerfil(): void {
    this.medicoService.obtenerMiPerfil().subscribe({
      next: (medico) => {
        this.medico.set(medico);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 404) {
          this.sinPerfil.set(true);
        } else {
          this.errorMessage.set('No se pudo cargar tu perfil profesional.');
        }
      }
    });
  }

  activarEdicion(): void {
    this.modoEdicion.set(true);
    this.limpiarMensaje();
  }

  cancelarEdicion(): void {
    this.modoEdicion.set(false);
  }

  onPerfilGuardado(medico: MedicoResponse): void {
    this.medico.set(medico);
    this.modoEdicion.set(false);
  }

  toggleEstado(): void {
    const medico = this.medico();
    if (!medico || this.procesandoAccion()) return;

    const nuevoEstado = medico.estado === 'activo' ? 'inactivo' : 'activo';
    this.procesandoAccion.set(true);
    this.limpiarMensaje();

    this.medicoService.cambiarEstado(medico.id_medico, nuevoEstado).subscribe({
      next: (actualizado) => {
        this.medico.set(actualizado);
        this.procesandoAccion.set(false);
        this.mostrarMensaje(
          'success',
          actualizado.estado === 'activo'
            ? 'El médico fue activado exitosamente.'
            : 'El médico fue desactivado (no aparecerá en el listado general).'
        );
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.mostrarMensaje('error', this.extraerDetalle(err) || 'No se pudo cambiar el estado del médico.');
      }
    });
  }

  asignarEspecialidad(): void {
    const medico = this.medico();
    const idEspecialidad = this.nuevaEspecialidadId();
    if (!medico || !idEspecialidad || this.procesandoAccion()) return;

    const asignacion: AsignacionEspecialidad = {
      id_especialidad: idEspecialidad,
      es_principal: this.nuevaEsPrincipal()
    };

    this.procesandoAccion.set(true);
    this.limpiarMensaje();

    this.medicoService.asignarEspecialidad(medico.id_medico, asignacion).subscribe({
      next: (actualizado) => {
        this.medico.set(actualizado);
        this.procesandoAccion.set(false);
        this.nuevaEspecialidadId.set(null);
        this.nuevaEsPrincipal.set(false);
        this.mostrarMensaje('success', 'Especialidad asignada exitosamente.');
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.mostrarMensaje('error', this.extraerDetalle(err) || 'No se pudo asignar la especialidad.');
      }
    });
  }

  quitarEspecialidad(idEspecialidad: number): void {
    const medico = this.medico();
    if (!medico || this.procesandoAccion()) return;

    this.procesandoAccion.set(true);
    this.limpiarMensaje();

    this.medicoService.quitarEspecialidad(medico.id_medico, idEspecialidad).subscribe({
      next: (actualizado) => {
        this.medico.set(actualizado);
        this.procesandoAccion.set(false);
        this.mostrarMensaje('success', 'Especialidad removida del perfil.');
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.mostrarMensaje('error', this.extraerDetalle(err) || 'No se pudo quitar la especialidad.');
      }
    });
  }

  seleccionarEspecialidad(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.nuevaEspecialidadId.set(value ? Number(value) : null);
  }

  togglePrincipal(event: Event): void {
    this.nuevaEsPrincipal.set((event.target as HTMLInputElement).checked);
  }

  onNuevaEspecialidadKeydown(event: Event): void {
    if ((event as KeyboardEvent).key === 'Enter') {
      event.preventDefault();
      this.asignarEspecialidad();
    }
  }

  abrirFormEspecialidad(): void {
    this.mostrarFormEspecialidad.set(true);
    this.nuevaEspNombre = '';
    this.nuevaEspDescripcion = '';
    this.errorEspecialidad.set(null);
  }

  cerrarFormEspecialidad(): void {
    this.mostrarFormEspecialidad.set(false);
    this.nuevaEspNombre = '';
    this.nuevaEspDescripcion = '';
    this.errorEspecialidad.set(null);
  }

  crearNuevaEspecialidad(): void {
    const nombre = this.nuevaEspNombre.trim();
    if (nombre.length < 3) {
      this.errorEspecialidad.set('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    this.guardandoEspecialidad.set(true);
    this.errorEspecialidad.set(null);

    const payload: EspecialidadCreate = {
      nombre,
      descripcion: this.nuevaEspDescripcion.trim() || undefined
    };

    this.medicoService.crearEspecialidad(payload).subscribe({
      next: (creada) => {
        this.guardandoEspecialidad.set(false);
        this.mostrarFormEspecialidad.set(false);
        this.nuevaEspNombre = '';
        this.nuevaEspDescripcion = '';
        this.cargarEspecialidades();
        this.nuevaEspecialidadId.set(creada.id_especialidad);
        this.mostrarMensaje('success', `Especialidad "${creada.nombre}" registrada en el catálogo y seleccionada.`);
      },
      error: (err) => {
        this.guardandoEspecialidad.set(false);
        if (err.status === 409) {
          this.errorEspecialidad.set('Ya existe una especialidad con este nombre.');
        } else {
          this.errorEspecialidad.set(this.extraerDetalle(err) || 'No se pudo crear la especialidad.');
        }
      }
    });
  }

  private mostrarMensaje(tipo: 'success' | 'error', mensaje: string): void {
    this.tipoMensaje.set(tipo);
    this.accionMessage.set(mensaje);
  }

  private limpiarMensaje(): void {
    this.accionMessage.set(null);
    this.tipoMensaje.set(null);
  }

  private extraerDetalle(err: any): string | null {
    const detail = err.error?.detail;
    return typeof detail === 'string' ? detail : null;
  }
}
