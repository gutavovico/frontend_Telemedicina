import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { MedicoService } from '../../../../core/services/medico.service';
import { AppointmentService } from '../../../../core/services/appointment.service';
import { MedicoResponse } from '../../../../core/models/medico.models';
import { Cita } from '../../../../core/models/appointment.models';
import { Header } from '../../../../shared/components/header/header';

export interface CitaAgenda {
  id_cita: number;
  id_paciente: number;
  hora: string;
  paciente: string;
  iniciales: string;
  colorAvatar: string;
  motivo: string;
  /** Valor real persistido en backend (p. ej. PENDIENTE, CONFIRMADA, CANCELADA, COMPLETADA, FINALIZADA). No se altera. */
  estado: string;
  /** Indica si la cita admite iniciar atención clínica (CU28). */
  esAtendible: boolean;
}

/** Estados que nunca son atendibles (comparación en mayúsculas). CU28. */
export const ESTADOS_CITA_NO_ATENDIBLES = ['CANCELADA', 'COMPLETADA', 'FINALIZADA'];

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-800',
];

@Component({
  selector: 'app-doctor-dashboard',
  imports: [CommonModule, FormsModule, Header],
  templateUrl: './doctor-dashboard.html',
  styleUrl: './doctor-dashboard.css'
})
export class DoctorDashboard implements OnInit {
  readonly authService = inject(AuthService);
  private readonly medicoService = inject(MedicoService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly router = inject(Router);

  readonly miPerfil = signal<MedicoResponse | null>(null);
  readonly seccionActiva = signal<'dashboard' | 'agenda' | 'pacientes' | 'mensajes'>('dashboard');
  readonly searchQuery = signal('');

  /** Agenda real del día construida desde GET /citas. Sin datos simulados. */
  readonly agendaDelDia = signal<CitaAgenda[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

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
    const perfil = this.miPerfil();
    const nombrePerfil = perfil?.usuario
      ? `${perfil.usuario.nombres ?? ''} ${perfil.usuario.apellidos ?? ''}`.trim()
      : '';
    if (nombrePerfil) {
      return `Dr. ${nombrePerfil}`;
    }
    const user = this.authService.currentUser();
    if (user) {
      const nombreCompleto = `${user.nombres || ''} ${user.apellidos || ''}`.trim();
      if (nombreCompleto) {
        return `Dr. ${nombreCompleto}`;
      }
      const display = this.authService.userDisplayName();
      if (display && display !== 'Usuario') {
        return `Dr. ${display}`;
      }
    }
    return 'Panel Médico';
  });

  readonly especialidadDoctor = computed(() => {
    const perfil = this.miPerfil();
    if (perfil && perfil.especialidades && perfil.especialidades.length > 0) {
      const principal = perfil.especialidades.find(e => e.es_principal) || perfil.especialidades[0];
      return principal.nombre;
    }
    return 'Sin especialidad asignada';
  });

  readonly fotoDoctor = computed(() => {
    return this.miPerfil()?.foto_perfil || this.authService.userPhoto() || null;
  });

  /** CU28: Consultas pendientes = citas reales atendibles cargadas. Sin número fijo. */
  readonly totalConsultasPendientes = computed(() =>
    this.agendaDelDia().filter((c) => c.esAtendible).length
  );

  readonly totalCitasHoy = computed(() => this.agendaDelDia().length);

  readonly totalNoAtendibles = computed(() =>
    this.agendaDelDia().filter((c) => !c.esAtendible).length
  );

  /** Filtro local por buscador (paciente, motivo, hora, estado real). */
  readonly agendaFiltrada = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const agenda = this.agendaDelDia();
    if (!q) return agenda;
    return agenda.filter((c) =>
      c.paciente.toLowerCase().includes(q) ||
      c.motivo.toLowerCase().includes(q) ||
      c.hora.toLowerCase().includes(q) ||
      c.estado.toLowerCase().includes(q) ||
      String(c.id_cita).includes(q) ||
      String(c.id_paciente).includes(q)
    );
  });

  ngOnInit(): void {
    this.cargarDatosDoctor();
  }

  /** Fecha actual en formato YYYY-MM-DD (local, sin desplazamiento UTC). */
  obtenerFechaHoyIso(fecha: Date = new Date()): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** CU28: una cita es atendible salvo CANCELADA, COMPLETADA o FINALIZADA. */
  esCitaAtendible(estado: string | null | undefined): boolean {
    if (!estado) return false;
    return !ESTADOS_CITA_NO_ATENDIBLES.includes(estado.trim().toUpperCase());
  }

  /** Transforma una Cita real de la API al modelo de presentación sin alterar IDs ni estado. */
  mapearCitaACitaAgenda(cita: Cita): CitaAgenda {
    const nombre = (cita.paciente_nombre || '').trim() || `Paciente #${cita.id_paciente}`;
    const iniciales = (cita.paciente_iniciales || '').trim() || this.calcularIniciales(nombre, cita.id_paciente);
    const motivo = (cita.motivo || '').trim() || '(Sin motivo registrado)';
    const estado = (cita.estado || 'PENDIENTE').trim() || 'PENDIENTE';
    return {
      id_cita: cita.id_cita,
      id_paciente: cita.id_paciente,
      hora: this.formatearHora(cita.hora_inicio),
      paciente: nombre,
      iniciales,
      colorAvatar: this.colorAvatarPara(cita.id_paciente),
      motivo,
      estado,
      esAtendible: this.esCitaAtendible(estado),
    };
  }

  cargarDatosDoctor(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.medicoService.obtenerMiPerfil().subscribe({
      next: (perfil) => {
        this.miPerfil.set(perfil);
        this.cargarAgendaDelDia(perfil.id_medico);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail;
        this.errorMessage.set(
          (typeof detail === 'string' && detail) || 'No se pudo cargar el perfil del médico autenticado.'
        );
        this.agendaDelDia.set([]);
      }
    });
  }

  /** CU28: consume GET /citas?id_medico=...&fecha=YYYY-MM-DD con la API existente. */
  cargarAgendaDelDia(idMedico: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const fecha = this.obtenerFechaHoyIso();
    this.appointmentService.listarCitas(undefined, fecha, undefined, idMedico, undefined, 1, 50).subscribe({
      next: (res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        this.agendaDelDia.set(items.map((c) => this.mapearCitaACitaAgenda(c)));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail;
        this.errorMessage.set(
          (typeof detail === 'string' && detail) || 'No se pudo cargar la agenda del día.'
        );
        this.agendaDelDia.set([]);
      }
    });
  }

  reintentar(): void {
    const perfil = this.miPerfil();
    if (perfil) {
      this.cargarAgendaDelDia(perfil.id_medico);
    } else {
      this.cargarDatosDoctor();
    }
  }

  /** Etiqueta legible del estado real (no muta el valor persistido). */
  etiquetaEstado(estado: string): string {
    const v = (estado || '').trim().toUpperCase();
    switch (v) {
      case 'PENDIENTE': return 'Pendiente';
      case 'CONFIRMADA': return 'Confirmada';
      case 'COMPLETADA': return 'Completada';
      case 'CANCELADA': return 'Cancelada';
      case 'FINALIZADA': return 'Finalizada';
      default: {
        const lower = (estado || '').toLowerCase().replace(/_/g, ' ').trim();
        return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : '—';
      }
    }
  }

  /** Clases del badge según estado real (solo visual). */
  claseEstado(estado: string): string {
    const v = (estado || '').trim().toUpperCase();
    switch (v) {
      case 'PENDIENTE':
        return 'bg-[#F1F5F9] text-[#64748B]';
      case 'CONFIRMADA':
        return 'bg-[#FEF9C3] text-[#A16207]';
      case 'COMPLETADA':
      case 'FINALIZADA':
        return 'bg-[#DCFCE7] text-[#15803D]';
      case 'CANCELADA':
        return 'bg-[#FEE2E2] text-[#B91C1C]';
      default:
        return 'bg-slate-100 text-slate-600';
    }
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

  /** CU28: solo navega con IDs reales de la API y únicamente si la cita es atendible. */
  atenderCita(cita: CitaAgenda): void {
    if (!cita || !cita.esAtendible) {
      return;
    }
    if (!Number.isInteger(cita.id_cita) || cita.id_cita <= 0) {
      return;
    }
    if (!Number.isInteger(cita.id_paciente) || cita.id_paciente <= 0) {
      return;
    }
    this.router.navigate(['/pacientes', cita.id_paciente, 'consultas', 'nueva'], {
      queryParams: { id_cita: cita.id_cita }
    });
  }

  verHcePaciente(idPaciente: number): void {
    if (!Number.isInteger(idPaciente) || idPaciente <= 0) {
      return;
    }
    this.router.navigate(['/pacientes', idPaciente, 'hce']);
  }

  nuevaCita(): void {
    // Acción rápida para nueva cita o consulta
  }

  logout(): void {
    this.authService.logout();
  }

  private formatearHora(horaInicio: string | null | undefined): string {
    if (!horaInicio) return '--:--';
    const partes = horaInicio.split(':');
    if (partes.length < 2) return horaInicio;
    const h = Number(partes[0]);
    const m = partes[1].padStart(2, '0').slice(0, 2);
    if (!Number.isInteger(h) || h < 0 || h > 23) return horaInicio;
    const sufijo = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${m} ${sufijo}`;
  }

  private calcularIniciales(nombre: string, idPaciente: number): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return `${partes[0].charAt(0)}${partes[1].charAt(0)}`.toUpperCase();
    }
    if (partes.length === 1 && partes[0].length >= 2) {
      return partes[0].substring(0, 2).toUpperCase();
    }
    return `P${Math.abs(idPaciente) % 100}`;
  }

  private colorAvatarPara(idPaciente: number): string {
    const idx = Math.abs(Number(idPaciente) || 0) % AVATAR_PALETTE.length;
    return AVATAR_PALETTE[idx];
  }
}
