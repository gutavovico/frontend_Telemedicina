import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MedicoService } from '../../../core/services/medico.service';
import { MedicoResponse } from '../../../core/models/medico.models';
import { Header } from '../../../shared/components/header/header';

export interface CitaAgenda {
  id: number;
  id_paciente: number;
  hora: string;
  paciente: string;
  iniciales: string;
  colorAvatar: string;
  motivo: string;
  estado: 'En curso' | 'En sala' | 'Programada' | 'Finalizada';
}

export interface ActividadReciente {
  id: number;
  titulo: string;
  descripcion: string;
  tiempo: string;
  tipo: 'mensaje' | 'resultado' | 'cita';
  colorBorde: string;
}

@Component({
  selector: 'app-doctor-dashboard',
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './doctor-dashboard.html',
  styleUrl: './doctor-dashboard.css'
})
export class DoctorDashboard implements OnInit {
  readonly authService = inject(AuthService);
  private readonly medicoService = inject(MedicoService);
  private readonly router = inject(Router);

  readonly miPerfil = signal<MedicoResponse | null>(null);
  readonly seccionActiva = signal<'dashboard' | 'agenda' | 'pacientes' | 'mensajes'>('dashboard');
  readonly searchQuery = signal('');

  // Fecha actual en español formateada como en el diseño (ej: Jueves, 26 de Octubre de 2023)
  readonly fechaActual = computed(() => {
    const fecha = new Date();
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    const formateada = fecha.toLocaleDateString('es-ES', opciones);
    return formateada.charAt(0).toUpperCase() + formateada.slice(1);
  });

  readonly nombreDoctor = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return 'Dr. Gustavo Sandoval';
    const nombres = user.nombres || '';
    const apellidos = user.apellidos || '';
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    if (nombreCompleto) {
      return `Dr. ${nombreCompleto}`;
    }
    return `Dr. ${this.authService.userDisplayName()}`;
  });

  readonly especialidadDoctor = computed(() => {
    const perfil = this.miPerfil();
    if (perfil && perfil.especialidades && perfil.especialidades.length > 0) {
      const principal = perfil.especialidades.find(e => e.es_principal) || perfil.especialidades[0];
      return principal.nombre;
    }
    return 'Medicina General';
  });

  readonly fotoDoctor = computed(() => {
    return this.miPerfil()?.foto_perfil || this.authService.userPhoto() || null;
  });

  // Métricas / KPIs del Dashboard
  readonly totalConsultasPendientes = signal(8);
  readonly totalPacientesEspera = signal(3);
  readonly totalNuevosMensajes = signal(14);

  // Agenda del día
  readonly agendaDelDia = signal<CitaAgenda[]>([
    {
      id: 1,
      id_paciente: 1,
      hora: '09:00 AM',
      paciente: 'María Rodríguez',
      iniciales: 'MR',
      colorAvatar: 'bg-blue-100 text-blue-700',
      motivo: 'Revisión Mensual',
      estado: 'En curso'
    },
    {
      id: 2,
      id_paciente: 2,
      hora: '09:30 AM',
      paciente: 'Juan Carlos Gómez',
      iniciales: 'JG',
      colorAvatar: 'bg-indigo-100 text-indigo-700',
      motivo: 'Resultados Análisis',
      estado: 'En sala'
    },
    {
      id: 3,
      id_paciente: 3,
      hora: '10:15 AM',
      paciente: 'Ana López',
      iniciales: 'AL',
      colorAvatar: 'bg-rose-100 text-rose-700',
      motivo: 'Primera Consulta',
      estado: 'Programada'
    },
    {
      id: 4,
      id_paciente: 4,
      hora: '11:00 AM',
      paciente: 'Pedro Martínez',
      iniciales: 'PM',
      colorAvatar: 'bg-amber-100 text-amber-800',
      motivo: 'Seguimiento Presión',
      estado: 'Programada'
    }
  ]);

  // Actividades recientes
  readonly actividadesRecientes = signal<ActividadReciente[]>([
    {
      id: 1,
      titulo: 'Nuevo mensaje recibido',
      descripcion: 'De: Dra. Camila Torres (Laboratorio)',
      tiempo: 'Hace 10 min',
      tipo: 'mensaje',
      colorBorde: 'border-teal-500'
    },
    {
      id: 2,
      titulo: 'Resultados subidos',
      descripcion: 'Estudio de Juan Carlos Gómez disponible.',
      tiempo: 'Hace 45 min',
      tipo: 'resultado',
      colorBorde: 'border-blue-500'
    },
    {
      id: 3,
      titulo: 'Cita finalizada',
      descripcion: 'Roberto Sánchez - Control General.',
      tiempo: 'Hace 2 horas',
      tipo: 'cita',
      colorBorde: 'border-slate-300'
    }
  ]);

  ngOnInit(): void {
    this.cargarDatosDoctor();
  }

  cargarDatosDoctor(): void {
    this.medicoService.obtenerMiPerfil().subscribe({
      next: (perfil) => {
        this.miPerfil.set(perfil);
      },
      error: () => {
        // Fallback suave
      }
    });
  }

  cambiarSeccion(seccion: 'dashboard' | 'agenda' | 'pacientes' | 'mensajes'): void {
    this.seccionActiva.set(seccion);
    if (seccion === 'pacientes') {
      this.router.navigate(['/pacientes']);
    }
  }

  goToEditarPerfil(): void {
    this.router.navigate(['/mi-perfil-medico']);
  }

  atenderCita(cita: CitaAgenda): void {
    this.router.navigate(['/pacientes', cita.id_paciente || 1, 'consultas', 'nueva'], {
      queryParams: { id_cita: cita.id }
    });
  }

  verHcePaciente(idPaciente: number): void {
    this.router.navigate(['/pacientes', idPaciente, 'hce']);
  }

  nuevaCita(): void {
    // Acción rápida para nueva cita o consulta
  }

  logout(): void {
    this.authService.logout();
  }
}
