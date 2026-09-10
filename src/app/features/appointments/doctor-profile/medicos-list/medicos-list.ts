import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EspecialidadCreate, EspecialidadResponse, MedicoResponse } from '../../../../core/models/medico.models';
import { MedicoService } from '../../../../core/services/medico.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Header } from '../../../../shared/components/header/header';
import { DoctorDashboard } from '../doctor-dashboard/doctor-dashboard';

@Component({
  selector: 'app-medicos-list',
  imports: [CommonModule, FormsModule, RouterLink, Header, DoctorDashboard],
  templateUrl: './medicos-list.html',
  styleUrl: './medicos-list.css'
})
export class MedicosList implements OnInit {
  private readonly medicoService = inject(MedicoService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly medicos = signal<MedicoResponse[]>([]);
  readonly especialidades = signal<EspecialidadResponse[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly limite = 10;

  // Modales
  readonly mostrarFormEspecialidad = signal(false);
  readonly guardandoEspecialidad = signal(false);
  readonly errorEspecialidad = signal<string | null>(null);
  nuevaEspNombre = '';
  nuevaEspDescripcion = '';
  readonly exitoEspecialidad = signal<string | null>(null);

  readonly page = signal(1);
  readonly limit = 9;

  // Filtros
  filtroNombre = '';
  filtroEspecialidad = '';
  filtroEstado = 'activo';

  ngOnInit(): void {
    // CU04: El módulo está disponible para administradores y médicos
    if (!this.authService.isAdmin() && !this.authService.isDoctor()) {
      this.router.navigate(['/']);
      return;
    }
    // Si es Administrador, cargamos la gestión de médicos y catálogo administrativo
    if (this.authService.isAdmin()) {
      this.cargarEspecialidades();
      this.cargarMedicos();
    }
  }

  abrirFormEspecialidad(): void {
    this.mostrarFormEspecialidad.set(true);
    this.nuevaEspNombre = '';
    this.nuevaEspDescripcion = '';
    this.errorEspecialidad.set(null);
    this.exitoEspecialidad.set(null);
  }

  cerrarFormEspecialidad(): void {
    this.mostrarFormEspecialidad.set(false);
    this.nuevaEspNombre = '';
    this.nuevaEspDescripcion = '';
    this.errorEspecialidad.set(null);
    this.exitoEspecialidad.set(null);
  }

  crearNuevaEspecialidad(): void {
    const nombre = this.nuevaEspNombre.trim();
    if (nombre.length < 3) {
      this.errorEspecialidad.set('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    this.guardandoEspecialidad.set(true);
    this.errorEspecialidad.set(null);
    this.exitoEspecialidad.set(null);

    const payload: EspecialidadCreate = {
      nombre,
      descripcion: this.nuevaEspDescripcion.trim() || undefined
    };

    this.medicoService.crearEspecialidad(payload).subscribe({
      next: (creada) => {
        this.guardandoEspecialidad.set(false);
        this.nuevaEspNombre = '';
        this.nuevaEspDescripcion = '';
        this.cargarEspecialidades();
        this.exitoEspecialidad.set(`Especialidad "${creada.nombre}" creada exitosamente en el catálogo.`);
        setTimeout(() => {
          this.cerrarFormEspecialidad();
        }, 2000);
      },
      error: (err) => {
        this.guardandoEspecialidad.set(false);
        if (err.status === 409) {
          this.errorEspecialidad.set('Ya existe una especialidad con este nombre.');
        } else {
          const detail = err.error?.detail;
          this.errorEspecialidad.set(
            (typeof detail === 'string' ? detail : null) || 'No se pudo crear la especialidad.'
          );
        }
      }
    });
  }

  cargarEspecialidades(): void {
    this.medicoService.listarEspecialidades().subscribe({
      next: (especialidades) => this.especialidades.set(especialidades),
      error: () => this.errorMessage.set('No se pudo cargar el catálogo de especialidades.')
    });
  }

  cargarMedicos(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.medicoService.listarMedicos({
      nombre: this.filtroNombre.trim() || undefined,
      id_especialidad: this.filtroEspecialidad ? Number(this.filtroEspecialidad) : undefined,
      estado: this.filtroEstado || undefined,
      skip: (this.page() - 1) * this.limit,
      limit: this.limit
    }).subscribe({
      next: (response) => {
        this.medicos.set(response.items);
        this.total.set(response.total);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err.error?.detail;
        this.errorMessage.set(
          (typeof detail === 'string' ? detail : null) || 'No se pudo cargar el listado de médicos.'
        );
      }
    });
  }

  buscar(): void {
    this.page.set(1);
    this.cargarMedicos();
  }

  limpiarFiltros(): void {
    this.filtroNombre = '';
    this.filtroEspecialidad = '';
    this.filtroEstado = 'activo';
    this.page.set(1);
    this.cargarMedicos();
  }

  paginaAnterior(): void {
    if (this.paginaAnteriorDisponible()) {
      this.page.update(p => p - 1);
      this.cargarMedicos();
    }
  }

  paginaSiguiente(): void {
    if (this.paginaSiguienteDisponible()) {
      this.page.update(p => p + 1);
      this.cargarMedicos();
    }
  }

  paginaAnteriorDisponible(): boolean {
    return this.page() > 1;
  }

  paginaSiguienteDisponible(): boolean {
    return this.page() * this.limit < this.total();
  }

  rangoMostrado(): string {
    if (this.total() === 0) return '0';
    const inicio = (this.page() - 1) * this.limit + 1;
    const fin = Math.min(this.page() * this.limit, this.total());
    return `${inicio}-${fin}`;
  }

  nombreCompleto(medico: MedicoResponse): string {
    const usuario = medico.usuario;
    if (usuario?.nombres || usuario?.apellidos) {
      return `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim();
    }
    return `Médico #${medico.id_medico}`;
  }

  iniciales(medico: MedicoResponse): string {
    const usuario = medico.usuario;
    if (usuario?.nombres && usuario?.apellidos) {
      return (
        usuario.nombres.trim().charAt(0).toUpperCase() +
        usuario.apellidos.trim().charAt(0).toUpperCase()
      );
    }
    return 'MD';
  }

  foto(medico: MedicoResponse): string | null {
    return medico.foto_perfil || medico.usuario?.foto_perfil || null;
  }

  especialidadPrincipal(medico: MedicoResponse): EspecialidadResponse | null {
    const principal = medico.especialidades.find(e => e.es_principal);
    if (!principal) return null;
    const esp = this.especialidades().find(e => e.id_especialidad === principal.id_especialidad);
    return esp ? esp : { id_especialidad: principal.id_especialidad, nombre: principal.nombre, estado: 'activo' };
  }

  otrasEspecialidades(medico: MedicoResponse): MedicoResponse['especialidades'] {
    return medico.especialidades.filter(e => !e.es_principal);
  }
}
