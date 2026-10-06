import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Header } from '../../../shared/components/header/header';
import { AppointmentService } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { MedicoService } from '../../../core/services/medico.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { Cita, CitaCreateRequest, CitaUpdateRequest } from '../../../core/models/appointment.models';
import { Paciente } from '../../../core/models/patient.models';
import { MedicoResponse } from '../../../core/models/medico.models';

import { ChatFloatingWidgetComponent } from '../../teleconsulta/components/chat-floating-widget/chat-floating-widget.component';

function fechaLocalIso(fecha: Date = new Date()): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-consultas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Header, ChatFloatingWidgetComponent],
  templateUrl: './consultas.html',
  styleUrl: './consultas.css'
})
export class ConsultasComponent implements OnInit {
  readonly appointmentService = inject(AppointmentService);
  readonly patientService = inject(PatientService);
  readonly medicoService = inject(MedicoService);
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Estados reactivos con Signals
  readonly searchTerm = signal<string>('');
  readonly selectedFilterDate = signal<string>('');
  readonly selectedStatusFilter = signal<string>('TODOS');
  readonly isEditing = signal<boolean>(false);
  readonly editingCitaId = signal<number | null>(null);
  readonly isFormOpen = signal<boolean>(false);
  readonly showDeleteModal = signal<boolean>(false);
  readonly citaToDelete = signal<Cita | null>(null);
  readonly alertMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly isNewPatient = signal<boolean>(false);


  readonly stats = computed(() => {
    const citas = this.filteredCitas();
    const todayStr = fechaLocalIso();
    const hoy = citas.filter(c => c.fecha_cita?.startsWith(todayStr)).length;
    const confirmadas = citas.filter(c => c.estado === 'CONFIRMADA').length;
    const pendientes = citas.filter(c => c.estado === 'PENDIENTE').length;
    const canceladas = citas.filter(c => c.estado === 'CANCELADA').length;
    return { hoy, confirmadas, pendientes, canceladas, total: citas.length };
  });


  // Paginación
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  readonly paginatedCitas = computed(() => {
    const all = this.filteredCitas();
    const start = (this.currentPage() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });
  
  readonly totalPages = computed(() => {
    return Math.ceil(this.filteredCitas().length / this.pageSize()) || 1;
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // Widget flotante de chat CU15
  readonly showChatWidget = signal<boolean>(false);
  readonly chatCitaActiva = signal<Cita | null>(null);

  // Listas para los dropdowns
  readonly pacientesList = signal<Paciente[]>([]);
  readonly medicosList = signal<MedicoResponse[]>([]);

  // Horarios disponibles


  readonly selectedFormDate = signal<string>(fechaLocalIso());
  readonly selectedFormDoctor = signal<number>(0);

  onFormChange(): void {
    if (this.appointmentForm) {
      const val = this.appointmentForm.value;
      if (val.fecha_cita) this.selectedFormDate.set(val.fecha_cita);
      if (val.id_medico) this.selectedFormDoctor.set(Number(val.id_medico));
    }
  }

  readonly reservedSlots = computed(() => {
    const date = this.selectedFormDate();
    const doctorId = this.selectedFormDoctor();
    // Exclude the current editing appointment from being marked as reserved!
    const editingId = this.editingCitaId();
    
    return this.appointmentService.citas()
      .filter(c => c.fecha_cita?.startsWith(date) &&
                   c.id_medico === doctorId && 
                   c.estado !== 'CANCELADA' && 
                   c.id_cita !== editingId)
      .map(c => c.hora_inicio ? c.hora_inicio.substring(0, 5) : '');
  });
  // Modalidad de consulta
  readonly tipoConsulta = signal<string>('PRESENCIAL');

  readonly availableSlots = computed(() => {
    const isPresencial = this.tipoConsulta() === 'PRESENCIAL';
    if (isPresencial) {
      // 45 min slots
      return [
        '09:00', '09:45', '10:30', '11:15',
        '14:00', '14:45', '15:30', '16:15'
      ];
    } else {
      // 30 min slots
      return [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
      ];
    }
  });

  setTipoConsulta(tipo: string): void {
    this.tipoConsulta.set(tipo);
    this.appointmentForm.patchValue({ tipo_consulta: tipo });
    this.onFormChange();
    // Reset selected slot when modality changes to avoid invalid slots
    this.selectedSlot.set('09:00');
    this.appointmentForm.patchValue({ hora_inicio: '09:00' });
    this.onFormChange();
  }

  readonly selectedSlot = signal<string>('09:30');

  // Formulario reactivo
  appointmentForm!: FormGroup;
  newPatientForm!: FormGroup;

  // Lista filtrada en tiempo real
  readonly filteredCitas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const status = this.selectedStatusFilter();
    const filterDate = this.selectedFilterDate();
    let list = this.appointmentService.citas();

    if (term) {
      list = list.filter((c) =>
        (c.paciente_nombre?.toLowerCase().includes(term)) ||
        (c.paciente_ci?.toLowerCase().includes(term)) ||
        (c.medico_nombre?.toLowerCase().includes(term)) ||
        (c.especialidad_nombre?.toLowerCase().includes(term)) ||
        (c.motivo?.toLowerCase().includes(term))
      );
    }

    if (status && status !== 'TODOS') {
      list = list.filter((c) => c.estado?.toUpperCase() === status.toUpperCase());
    }

    if (filterDate) {
      list = list.filter((c) => c.fecha_cita === filterDate);
    }

    return list;
  });

  ngOnInit(): void {
    if (this.authService.isPaciente()) {
      this.router.navigate(['/mis-citas']);
      return;
    }
    this.initForm();
    this.cargarDatosIniciales();
  }

  initForm(): void {
    const today = fechaLocalIso();
    this.appointmentForm = this.fb.group({
      id_paciente: ['', [Validators.required]],
      id_medico: [0, [Validators.required, Validators.min(1)]],
      fecha_cita: [today, [Validators.required]],
      hora_inicio: ['09:30', [Validators.required]],
      motivo: ['Consulta General'],
      estado: ['CONFIRMADA'],
      tipo_consulta: ['PRESENCIAL']
    });
    this.newPatientForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      ci: ['', [Validators.required, Validators.minLength(3)]],
      fecha_nacimiento: ['', [Validators.required]],
      genero: ['M', [Validators.required]],
      telefono: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  activarNuevoPaciente(): void {
    this.isNewPatient.set(true);
    this.appointmentForm.get('id_paciente')?.clearValidators();
    this.appointmentForm.get('id_paciente')?.updateValueAndValidity();
  }

  seleccionarPacienteRegistrado(): void {
    this.isNewPatient.set(false);
    this.appointmentForm.get('id_paciente')?.setValidators([Validators.required]);
    this.appointmentForm.get('id_paciente')?.updateValueAndValidity();
  }

  cargarDatosIniciales(): void {
    // 1. Cargar citas desde el backend
    if (this.authService.isDoctor()) {
      this.medicoService.obtenerMiPerfil().subscribe({
        next: (perfil) => {
          this.medicosList.set([perfil]);
          this.selectedFormDoctor.set(perfil.id_medico);
          this.appointmentForm.patchValue({ id_medico: perfil.id_medico });
          void this.cargarCitas(perfil.id_medico);
        },
        error: () => this.alertMessage.set({
          type: 'error', text: 'No se pudo cargar tu perfil médico.'
        })
      });
    } else {
      void this.cargarCitas();
      this.medicoService.listarMedicos({ limit: 100 }).subscribe({
        next: (res) => this.medicosList.set(res.items ?? []),
        error: () => this.alertMessage.set({
          type: 'error', text: 'No se pudo cargar la lista de médicos.'
        })
      });
    }

    // 2. Cargar lista de pacientes para el dropdown
    this.patientService.getPatients(1, 100).subscribe({
      next: (res) => {
        this.pacientesList.set(res.items ?? []);
      },
      error: () => this.alertMessage.set({
        type: 'error', text: 'No se pudo cargar la lista de pacientes.'
      })
    });
  }

  private async cargarCitas(idMedico?: number): Promise<void> {
    const citas: Cita[] = [];
    let page = 1;
    try {
      while (true) {
        const response = await firstValueFrom(
          this.appointmentService.listarCitas(undefined, undefined, undefined, idMedico, undefined, page, 100)
        );
        citas.push(...response.items);
        if (response.items.length === 0 || citas.length >= response.total) break;
        page += 1;
      }
      this.appointmentService.citas.set(citas);
    } catch {
      this.appointmentService.citas.set([]);
      this.alertMessage.set({
        type: 'error', text: 'No se pudieron cargar las citas. Reintenta la consulta.'
      });
    }
  }

  verHistoria(cita: Cita): void {
    void this.router.navigate(['/admin/pacientes', cita.id_paciente, 'hce']);
  }

  registrarAtencion(cita: Cita): void {
    if (!this.authService.isDoctor() || ['CANCELADA', 'COMPLETADA', 'FINALIZADA'].includes(cita.estado)) {
      return;
    }
    void this.router.navigate(['/admin/pacientes', cita.id_paciente, 'consultas', 'nueva'], {
      queryParams: { id_cita: cita.id_cita }
    });
  }

  selectSlot(slot: string): void {
    this.selectedSlot.set(slot);
    this.appointmentForm.patchValue({ hora_inicio: slot });
    this.onFormChange();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  filtrarPorHoy(): void {
    this.currentPage.set(1);
    const today = fechaLocalIso();
    if (this.selectedFilterDate() === today) {
      this.selectedFilterDate.set('');
    } else {
      this.selectedFilterDate.set(today);
    }
  }

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedFilterDate.set('');
    this.selectedStatusFilter.set('TODOS');
  }

  // EDICIÓN EN TIEMPO REAL
  iniciarEdicion(cita: Cita): void {
    this.isEditing.set(true);
    this.editingCitaId.set(cita.id_cita);
    this.isFormOpen.set(true);
    this.selectedSlot.set(cita.hora_inicio ?? '');
      this.tipoConsulta.set(cita.tipo_consulta || 'PRESENCIAL');

    // Asegurar que el paciente de la cita esté en la lista para que el <select> lo muestre
    const pId = Number(cita.id_paciente);
    const mId = Number(cita.id_medico);

    const existePaciente = this.pacientesList().some(p => p.id_paciente === pId);
    if (!existePaciente) {
      this.patientService.getPatientById(pId).subscribe({
        next: (paciente) => this.pacientesList.update(prev => [paciente, ...prev]),
        error: () => this.mostrarAlerta('error', 'No se pudo cargar el paciente de esta cita.')
      });
    }

    // Asegurar que el médico esté en la lista
    const existeMedico = this.medicosList().some(m => m.id_medico === mId);
    if (!existeMedico) {
      this.medicoService.obtenerMedico(mId).subscribe({
        next: (medico) => this.medicosList.update(prev => [medico, ...prev]),
        error: () => this.mostrarAlerta('error', 'No se pudo cargar el médico de esta cita.')
      });
    }

    // Setear valores en el formulario
    this.appointmentForm.patchValue({
      id_paciente: pId,
      id_medico: mId,
      fecha_cita: cita.fecha_cita,
      hora_inicio: cita.hora_inicio,
      motivo: cita.motivo || 'Consulta Médica',
      estado: cita.estado,
      tipo_consulta: cita.tipo_consulta || 'TELEMEDICINA'
    });
    this.onFormChange();

    this.mostrarAlerta('success', `Datos de la cita de ${cita.paciente_nombre} cargados en el formulario.`);
  }


  toggleNewPatient(): void {
    this.isNewPatient.set(!this.isNewPatient());
    if (this.isNewPatient()) {
      this.appointmentForm.get('id_paciente')?.clearValidators();
      this.appointmentForm.get('id_paciente')?.updateValueAndValidity();
    } else {
      this.appointmentForm.get('id_paciente')?.setValidators(Validators.required);
      this.appointmentForm.get('id_paciente')?.updateValueAndValidity();
    }
  }

  cancelarEdicion(): void {
    this.isEditing.set(false);
    this.editingCitaId.set(null);
    this.seleccionarPacienteRegistrado();
    this.initForm();
    this.selectedSlot.set('09:30');
  }

  // AGENDAR / CONFIRMAR CITA
  guardarCita(): void {
    if (!this.isNewPatient() && this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched();
      this.mostrarAlerta('error', 'Por favor completa todos los campos requeridos.');
      return;
    }
    if (this.isNewPatient() && this.newPatientForm.invalid) {
      this.newPatientForm.markAllAsTouched();
      this.mostrarAlerta('error', 'Por favor completa todos los datos del nuevo paciente.');
      return;
    }

    const formValues = this.appointmentForm.value;

    if (this.isNewPatient()) {
      const npData = this.newPatientForm.value;
      this.patientService.createPatient(npData).subscribe({
        next: (newPatient) => {
          // Agregar a la lista local para que aparezca en el dropdown
          this.pacientesList.update(prev => [newPatient, ...prev]);
          this.guardarCitaParaPaciente(newPatient.id_paciente);
        },
        error: () => {
          this.mostrarAlerta('error', 'No se pudo registrar el paciente. La cita no se creó.');
        }
      });
      return;
    }

    this.guardarCitaParaPaciente(Number(formValues.id_paciente));
  }

  private guardarCitaParaPaciente(pId: number): void {
    const formValues = this.appointmentForm.value;
    const mId = Number(formValues.id_medico);

    if (this.isEditing() && this.editingCitaId()) {
      const citaId = this.editingCitaId()!;
      const updateData: CitaUpdateRequest = {
        id_paciente: pId,
        id_medico: mId,
        fecha_cita: formValues.fecha_cita,
        hora_inicio: formValues.hora_inicio,
        motivo: formValues.motivo,
        estado: formValues.estado,
        tipo_consulta: formValues.tipo_consulta
      };

      this.appointmentService.actualizarCita(citaId, updateData).subscribe({
        next: () => {
          this.mostrarAlerta('success', '¡Cita actualizada exitosamente en tiempo real!');
          this.cancelarEdicion();
        },
        error: () => {
          this.mostrarAlerta('error', 'No se pudo actualizar la cita. Los cambios no se guardaron.');
        }
      });
    } else {
      // Crear nueva cita
      const createData: CitaCreateRequest = {
        id_paciente: pId,
        id_medico: mId,
        fecha_cita: formValues.fecha_cita,
        hora_inicio: formValues.hora_inicio,
        motivo: formValues.motivo,
        estado: formValues.estado || 'CONFIRMADA',
        tipo_consulta: formValues.tipo_consulta || 'TELEMEDICINA'
      };

      this.appointmentService.crearCita(createData).subscribe({
        next: () => {
          this.mostrarAlerta('success', '¡Cita confirmada y agregada automáticamente a la tabla!');
          this.cancelarEdicion();
        },
        error: () => {
          this.mostrarAlerta('error', 'No se pudo crear la cita. No se registró en la base de datos.');
        }
      });
    }
  }

  // ELIMINACIÓN DINÁMICA
  solicitarEliminar(cita: Cita): void {
    this.citaToDelete.set(cita);
    this.showDeleteModal.set(true);
  }

  cerrarModalEliminar(): void {
    this.citaToDelete.set(null);
    this.showDeleteModal.set(false);
  }

  confirmarEliminar(): void {
    const cita = this.citaToDelete();
    if (!cita) return;

    this.appointmentService.eliminarCita(cita.id_cita).subscribe({
      next: () => {
        this.mostrarAlerta('success', `La cita de ${cita.paciente_nombre} ha sido eliminada instantáneamente.`);
        this.cerrarModalEliminar();
      },
      error: () => {
        this.mostrarAlerta('error', 'No se pudo eliminar la cita. Sigue registrada.');
      }
    });
  }

  // GESTIÓN DEL CHAT FLOTANTE CU15
  abrirChat(cita: Cita): void {
    this.abrirChatCita(cita);
  }

  abrirChatCita(cita: Cita): void {
    if (!cita) return;
    this.chatCitaActiva.set(cita);
    this.showChatWidget.set(true);
  }

  cerrarChatCita(): void {
    this.showChatWidget.set(false);
    this.chatCitaActiva.set(null);
  }

  mostrarAlerta(type: 'success' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => {
      this.alertMessage.set(null);
    }, 4000);
  }

  formatearFechaDisplay(fechaStr: string | null): string {
    if (!fechaStr) return 'Sin fecha';
    try {
      const parts = fechaStr.split('-');
      if (parts.length === 3) {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dia = parts[2];
        const mes = meses[parseInt(parts[1], 10) - 1] || parts[1];
        const anio = parts[0];
        return `${dia} ${mes} ${anio}`;
      }
      return fechaStr;
    } catch {
      return fechaStr;
    }
  }

  formatearHoraDisplay(hora: string | null): string {
    if (!hora) return 'Sin hora';
    try {
      const [hStr, mStr] = hora.split(':');
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      const hFormatted = h < 10 ? `0${h}` : `${h}`;
      return `${hFormatted}:${mStr || '00'} ${ampm}`;
    } catch {
      return hora;
    }
  }
}

export { ConsultasComponent as Appointments };
