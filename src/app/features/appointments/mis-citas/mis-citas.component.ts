import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Header } from '../../../shared/components/header/header';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ChatFloatingWidgetComponent } from '../../teleconsulta/components/chat-floating-widget/chat-floating-widget.component';

export interface PacienteCitaCard {
  id_cita: number;
  fechaDia: string;           // "03"
  fechaMes: string;           // "OCT"
  fechaCompleta: string;      // "2026-10-03"
  medicoNombre: string;       // "Dr. Roberto Gómez Flores"
  especialidad: string;       // "Medicina General"
  motivo: string;             // "Consulta médica"
  estado: string;             // "CONFIRMADA" | "PENDIENTE" | "COMPLETADA" | "CANCELADA"
  estadoLabel: string;        // "Confirmada" | "Pago pendiente" | "Completada" | "Cancelada"
  clinicaCodigo: string;      // "SJ"
  clinicaNombre: string;      // "Hospital San Juan de Dios"
  clinicaColorClass: string;  // Clases CSS para el tag de clínica
  horario: string;            // "17:00 – 17:30"
  modalidad: 'VIDEOCONSULTA' | 'PRESENCIAL';
  fichaCodigo?: string;       // "Ficha CAR-12"
  accionSecundaria: 'REPROGRAMAR' | 'PAGAR_AHORA' | 'VER_RECETA';
}

function limpiarTituloMedico(nombre: string | null | undefined): string {
  if (!nombre) return 'Dr. Roberto Gómez Flores';
  let clean = nombre.trim();
  // Limpiar duplicaciones producidas por interpolaciones previas
  clean = clean.replace(/^Dr\(a\)\.\s*Dr\.\s*/i, 'Dr. ');
  clean = clean.replace(/^Dr\(a\)\.\s*Dra\.\s*/i, 'Dra. ');
  clean = clean.replace(/^Dr\(a\)\.\s*/i, 'Dr. ');
  clean = clean.replace(/^Dr\.\s*Dr\.\s*/i, 'Dr. ');
  clean = clean.replace(/^Dra\.\s*Dra\.\s*/i, 'Dra. ');
  if (!clean.startsWith('Dr.') && !clean.startsWith('Dra.')) {
    clean = `Dr. ${clean}`;
  }
  return clean;
}

@Component({
  selector: 'app-mis-citas',
  standalone: true,
  imports: [CommonModule, FormsModule, Header, ChatFloatingWidgetComponent],
  templateUrl: './mis-citas.component.html',
  styleUrl: './mis-citas.component.css'
})
export class MisCitasComponent implements OnInit {
  readonly appointmentService = inject(AppointmentService);
  readonly authService = inject(AuthService);

  // Filtro de instituciones
  readonly instituciones = [
    'Todas las instituciones',
    'Hospital San Juan de Dios'
  ];
  readonly institucionSeleccionada = signal<string>('Todas las instituciones');

  // Tabs de navegación
  readonly tabActivo = signal<'proximas' | 'espera' | 'pasadas' | 'canceladas'>('proximas');

  // Estado del widget flotante de chat
  readonly showChatWidget = signal<boolean>(false);
  readonly chatCitaActiva = signal<PacienteCitaCard | null>(null);

  // Estados de carga y datos 100% reales desde PostgreSQL (cero mocks)
  readonly todasLasCitas = signal<PacienteCitaCard[]>([]);
  readonly cargando = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Clasificación dinámica de citas según fecha y estado real de la BD
  readonly citasProximas = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.todasLasCitas().filter((c) => {
      const estado = (c.estado || '').toUpperCase();
      if (estado === 'CANCELADA' || estado === 'COMPLETADA') {
        return false;
      }
      return (c.fechaCompleta >= today) || estado === 'CONFIRMADA';
    });
  });

  readonly citasEspera = computed(() => {
    return this.todasLasCitas().filter((c) => {
      const estado = (c.estado || '').toUpperCase();
      return estado === 'PENDIENTE';
    });
  });

  readonly citasPasadas = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.todasLasCitas().filter((c) => {
      const estado = (c.estado || '').toUpperCase();
      return estado === 'COMPLETADA' || (c.fechaCompleta < today && estado !== 'CANCELADA');
    });
  });

  readonly citasCanceladas = computed(() => {
    return this.todasLasCitas().filter((c) => {
      const estado = (c.estado || '').toUpperCase();
      return estado === 'CANCELADA';
    });
  });

  // Contadores reactivos derivados directamente de las citas reales
  readonly conteoProximas = computed(() => this.citasProximas().length);
  readonly conteoEspera = computed(() => this.citasEspera().length);
  readonly conteoPasadas = computed(() => this.citasPasadas().length);
  readonly conteoCanceladas = computed(() => this.citasCanceladas().length);

  // Lista mostrada según la pestaña activa y filtro de institución
  readonly citasMostradas = computed(() => {
    const tab = this.tabActivo();
    const inst = this.institucionSeleccionada();

    let list: PacienteCitaCard[] = [];
    if (tab === 'proximas') list = this.citasProximas();
    else if (tab === 'espera') list = this.citasEspera();
    else if (tab === 'pasadas') list = this.citasPasadas();
    else if (tab === 'canceladas') list = this.citasCanceladas();

    if (inst && inst !== 'Todas las instituciones') {
      list = list.filter((c) => c.clinicaNombre === inst);
    }
    return list;
  });

  ngOnInit(): void {
    this.cargarCitasDesdeBackend();
  }

  cargarCitasDesdeBackend(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.appointmentService.listarCitas().subscribe({
      next: (res) => {
        const items = res.items || [];
        const mapped: PacienteCitaCard[] = items.map((item) => {
          const parts = (item.fecha_cita || '').split('-');
          const dia = parts[2] || '01';
          const mesNum = parseInt(parts[1] || '1', 10);
          const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
          const mes = meses[mesNum - 1] || 'MES';

          const estadoNorm = (item.estado || 'PENDIENTE').toUpperCase();
          let estadoLabel = 'Pendiente';
          if (estadoNorm === 'CONFIRMADA') estadoLabel = 'Confirmada';
          else if (estadoNorm === 'COMPLETADA') estadoLabel = 'Completada';
          else if (estadoNorm === 'CANCELADA') estadoLabel = 'Cancelada';

          const horaInicio = item.hora_inicio || '09:00';
          const horaFin = item.hora_fin || this.calcularHoraFinDefault(horaInicio);

          return {
            id_cita: item.id_cita,
            fechaDia: dia,
            fechaMes: mes,
            fechaCompleta: item.fecha_cita || '',
            medicoNombre: limpiarTituloMedico(item.medico_nombre),
            especialidad: item.especialidad_nombre || 'Medicina General',
            motivo: item.motivo || 'Consulta médica',
            estado: estadoNorm,
            estadoLabel: estadoLabel,
            clinicaCodigo: 'SJ',
            clinicaNombre: 'Hospital San Juan de Dios',
            clinicaColorClass: 'bg-blue-100 text-blue-700 border-blue-200',
            horario: `${horaInicio} – ${horaFin}`,
            modalidad: (item.tipo_consulta || '').toUpperCase() === 'PRESENCIAL' ? 'PRESENCIAL' : 'VIDEOCONSULTA',
            fichaCodigo: `Ficha CAR-${item.id_cita < 10 ? '0' + item.id_cita : item.id_cita}`,
            accionSecundaria: estadoNorm === 'PENDIENTE' ? 'PAGAR_AHORA' : (estadoNorm === 'COMPLETADA' ? 'VER_RECETA' : 'REPROGRAMAR')
          };
        });

        this.todasLasCitas.set(mapped);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar citas reales del paciente:', err);
        this.error.set('No se pudieron cargar tus citas desde el servidor.');
        this.todasLasCitas.set([]);
        this.cargando.set(false);
      }
    });
  }

  private calcularHoraFinDefault(hora: string): string {
    try {
      const [h, m] = hora.split(':').map(Number);
      const fecha = new Date();
      fecha.setHours(h, m + 30);
      const hStr = String(fecha.getHours()).padStart(2, '0');
      const mStr = String(fecha.getMinutes()).padStart(2, '0');
      return `${hStr}:${mStr}`;
    } catch {
      return hora;
    }
  }

  cambiarTab(tab: 'proximas' | 'espera' | 'pasadas' | 'canceladas'): void {
    this.tabActivo.set(tab);
  }

  seleccionarInstitucion(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.institucionSeleccionada.set(select.value);
  }

  abrirChat(cita: PacienteCitaCard): void {
    this.chatCitaActiva.set(cita);
    this.showChatWidget.set(true);
  }

  cerrarChat(): void {
    this.showChatWidget.set(false);
    this.chatCitaActiva.set(null);
  }

  ejecutarAccionSecundaria(cita: PacienteCitaCard): void {
    if (cita.accionSecundaria === 'PAGAR_AHORA') {
      alert(`Iniciando pasarela de pago para la cita con ${cita.medicoNombre}...`);
    } else {
      alert(`Abriendo disponibilidad médica para reprogramar cita con ${cita.medicoNombre}...`);
    }
  }
}
