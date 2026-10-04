import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Header } from '../../shared/components/header/header';
import { AppointmentService } from '../../core/services/appointment.service';
import { PatientService } from '../../core/services/patient.service';
import { MedicoService } from '../../core/services/medico.service';
import { AuthService } from '../../core/services/auth.service';
import { Cita, CitaCreateRequest, CitaUpdateRequest } from '../../core/models/appointment.models';
import { Paciente } from '../../core/models/patient.models';
import { MedicoResponse } from '../../core/models/medico.models';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Header],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css'
})
export class Appointments implements OnInit {
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
  readonly isFormOpen = signal<boolean>(true);
  readonly showDeleteModal = signal<boolean>(false);
  readonly citaToDelete = signal<Cita | null>(null);
  readonly alertMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly isNewPatient = signal<boolean>(false);

  // Listas para los dropdowns
  readonly pacientesList = signal<Paciente[]>([]);
  readonly medicosList = signal<MedicoResponse[]>([]);

  // Horarios disponibles
  readonly availableSlots = signal<string[]>([
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ]);
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
    this.initForm();
    this.cargarDatosIniciales();
  }

  initForm(): void {
    const today = new Date().toISOString().split('T')[0];
    this.appointmentForm = this.fb.group({
      id_paciente: ['', [Validators.required]],
      id_medico: [1, [Validators.required]],
      fecha_cita: [today, [Validators.required]],
      hora_inicio: ['09:30', [Validators.required]],
      motivo: ['Consulta General'],
      estado: ['CONFIRMADA'],
      tipo_consulta: ['TELEMEDICINA']
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
    this.appointmentService.listarCitas().subscribe({
      next: (res) => {
        if (!res.items || res.items.length === 0) {
          this.crearCitasDemoSiVacio();
        }
      },
      error: () => {
        this.crearCitasDemoSiVacio();
      }
    });

    // 2. Cargar lista de pacientes para el dropdown
    this.patientService.getPatients(1, 100).subscribe({
      next: (res) => {
        if (res.items && res.items.length > 0) {
          this.pacientesList.set(res.items);
        } else {
          this.cargarPacientesDemo();
        }
      },
      error: () => this.cargarPacientesDemo()
    });

    // 3. Cargar lista de médicos para el dropdown
    this.medicoService.listarMedicos({ limit: 100 }).subscribe({
      next: (res) => {
        if (res.items && res.items.length > 0) {
          this.medicosList.set(res.items);
        } else {
          this.cargarMedicosDemo();
        }
      },
      error: () => this.cargarMedicosDemo()
    });
  }

  private cargarPacientesDemo(): void {
    this.pacientesList.set([
      {
        id_paciente: 1,
        nombres: 'Maria',
        apellidos: 'Rodriguez',
        ci: '982-11-2',
        complemento: '',
        fecha_nacimiento: '1990-05-12',
        genero: 'F',
        telefono: '+591 71234567',
        correo: 'maria.rodriguez@example.com',
        estado: 'ACTIVO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id_paciente: 2,
        nombres: 'Juan',
        apellidos: 'Gómez',
        ci: '451-88-9',
        complemento: '',
        fecha_nacimiento: '1985-08-20',
        genero: 'M',
        telefono: '+591 79876543',
        correo: 'juan.gomez@example.com',
        estado: 'ACTIVO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id_paciente: 3,
        nombres: 'Carlos',
        apellidos: 'Méndez',
        ci: '672-33-4',
        complemento: '',
        fecha_nacimiento: '1992-11-15',
        genero: 'M',
        telefono: '+591 78912345',
        correo: 'carlos.mendez@example.com',
        estado: 'ACTIVO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]);
  }

  private cargarMedicosDemo(): void {
    this.medicosList.set([
      {
        id_medico: 1,
        id_usuario: 1,
        matricula_profesional: 'MAT-00001',
        descripcion_profesional: 'Especialista en cardiología clínica',
        experiencia: '10 años en cardiología',
        estado: 'activo',
        fecha_registro: new Date().toISOString(),
        usuario: {
          id_usuario: 1,
          nombres: 'Carlos',
          apellidos: 'Mendoza',
          correo: 'doctor@telemedicina.com',
          telefono: '+591 71111111'
        },
        especialidades: [
          {
            id_especialidad: 1,
            nombre: 'Cardiología',
            es_principal: true
          }
        ]
      },
      {
        id_medico: 2,
        id_usuario: 2,
        matricula_profesional: 'MAT-00002',
        descripcion_profesional: 'Médico general y atención primaria',
        experiencia: '8 años en medicina general',
        estado: 'activo',
        fecha_registro: new Date().toISOString(),
        usuario: {
          id_usuario: 2,
          nombres: 'Ana',
          apellidos: 'Silva',
          correo: 'ana.silva@telemedicina.com',
          telefono: '+591 72222222'
        },
        especialidades: [
          {
            id_especialidad: 2,
            nombre: 'Medicina General',
            es_principal: true
          }
        ]
      },
      {
        id_medico: 3,
        id_usuario: 3,
        matricula_profesional: 'MAT-00003',
        descripcion_profesional: 'Pediatra especialista',
        experiencia: '6 años en pediatría',
        estado: 'activo',
        fecha_registro: new Date().toISOString(),
        usuario: {
          id_usuario: 3,
          nombres: 'Roberto',
          apellidos: 'Paz',
          correo: 'roberto.paz@telemedicina.com',
          telefono: '+591 73333333'
        },
        especialidades: [
          {
            id_especialidad: 3,
            nombre: 'Pediatría',
            es_principal: true
          }
        ]
      }
    ]);
  }

  private crearCitasDemoSiVacio(): void {
    const demoCitas: Cita[] = [
      {
        id_cita: 1,
        id_paciente: 1,
        id_medico: 1,
        id_especialidad: 1,
        fecha_cita: '2024-10-15',
        hora_inicio: '09:30',
        hora_fin: '10:00',
        motivo: 'Control cardiológico anual',
        estado: 'CONFIRMADA',
        tipo_consulta: 'TELEMEDICINA',
        paciente_nombre: 'Maria Rodriguez',
        paciente_ci: 'ID: 982-11-2',
        paciente_iniciales: 'MR',
        medico_nombre: 'Dr. Carlos Mendoza',
        especialidad_nombre: 'Cardiología',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id_cita: 2,
        id_paciente: 2,
        id_medico: 2,
        id_especialidad: 2,
        fecha_cita: '2024-10-15',
        hora_inicio: '11:00',
        hora_fin: '11:30',
        motivo: 'Evaluación de síntomas gripales',
        estado: 'PENDIENTE',
        tipo_consulta: 'TELEMEDICINA',
        paciente_nombre: 'Juan Gómez',
        paciente_ci: 'ID: 451-88-9',
        paciente_iniciales: 'JG',
        medico_nombre: 'Dra. Ana Silva',
        especialidad_nombre: 'Medicina General',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    this.appointmentService.citas.set(demoCitas);
  }

  selectSlot(slot: string): void {
    this.selectedSlot.set(slot);
    this.appointmentForm.patchValue({ hora_inicio: slot });
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  filtrarPorHoy(): void {
    const today = new Date().toISOString().split('T')[0];
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
    this.selectedSlot.set(cita.hora_inicio);

    // Asegurar que el paciente de la cita esté en la lista para que el <select> lo muestre
    const pId = Number(cita.id_paciente);
    const mId = Number(cita.id_medico);

    const existePaciente = this.pacientesList().some(p => p.id_paciente === pId);
    if (!existePaciente && cita.paciente_nombre) {
      const parts = cita.paciente_nombre.split(' ');
      const demoP: Paciente = {
        id_paciente: pId,
        nombres: parts[0] || 'Paciente',
        apellidos: parts.slice(1).join(' ') || '',
        ci: cita.paciente_ci?.replace('ID: ', '') || 'S/N',
        complemento: '',
        fecha_nacimiento: '1990-01-01',
        genero: 'M',
        telefono: '+591 70000000',
        estado: 'ACTIVO',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.pacientesList.update(prev => [demoP, ...prev]);
    }

    // Asegurar que el médico esté en la lista
    const existeMedico = this.medicosList().some(m => m.id_medico === mId);
    if (!existeMedico && cita.medico_nombre) {
      const mParts = cita.medico_nombre.replace('Dr(a). ', '').replace('Dr. ', '').replace('Dra. ', '').split(' ');
      const demoM: any = {
        id_medico: mId,
        id_usuario: mId,
        matricula_profesional: `MAT-00${mId}`,
        estado: 'activo',
        fecha_registro: new Date().toISOString(),
        usuario: {
          id_usuario: mId,
          nombres: mParts[0] || 'Doctor',
          apellidos: mParts.slice(1).join(' ') || 'Especialista',
          correo: 'doctor@telemedicina.com',
          telefono: '',
          estado: 'activo'
        },
        especialidades: [
          {
            id_especialidad: cita.id_especialidad || 1,
            nombre: cita.especialidad_nombre || 'Medicina General',
            es_principal: true
          }
        ]
      };
      this.medicosList.update(prev => [demoM, ...prev]);
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

    this.mostrarAlerta('success', `Datos de la cita de ${cita.paciente_nombre} cargados en el formulario.`);
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
          // Fallback: crear paciente en memoria si el backend está offline
          const idLocal = Date.now();
          const pacienteLocal: Paciente = {
            id_paciente: idLocal,
            nombres: npData.nombres,
            apellidos: npData.apellidos,
            ci: npData.ci,
            complemento: '',
            fecha_nacimiento: npData.fecha_nacimiento,
            genero: npData.genero,
            telefono: npData.telefono,
            estado: 'ACTIVO',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.pacientesList.update(prev => [pacienteLocal, ...prev]);
          this.guardarCitaParaPaciente(idLocal);
        }
      });
      return;
    }

    this.guardarCitaParaPaciente(Number(formValues.id_paciente));
  }

  private guardarCitaParaPaciente(pId: number): void {
    const formValues = this.appointmentForm.value;
    const mId = Number(formValues.id_medico);

    const pacienteSeleccionado = this.pacientesList().find(p => p.id_paciente === pId);
    const medicoSeleccionado = this.medicosList().find(m => m.id_medico === mId);

    // Si es nuevo paciente, usar datos del formulario de nuevo paciente
    const npData = this.newPatientForm.value;
    const nombrePaciente = pacienteSeleccionado
      ? `${pacienteSeleccionado.nombres} ${pacienteSeleccionado.apellidos}`.trim()
      : (this.isNewPatient() ? `${npData.nombres} ${npData.apellidos}`.trim() : 'Paciente');
    const ciPaciente = pacienteSeleccionado
      ? `ID: ${pacienteSeleccionado.ci}`
      : (this.isNewPatient() ? `ID: ${npData.ci}` : 'ID: S/N');
    const nombreMedico = medicoSeleccionado?.usuario
      ? `Dr(a). ${medicoSeleccionado.usuario.nombres} ${medicoSeleccionado.usuario.apellidos}`.trim()
      : (medicoSeleccionado ? `Médico #${mId}` : 'Dr. Médico Especialista');
    const espMedico = medicoSeleccionado?.especialidades?.[0]?.nombre || 'Medicina General';
    
    // Iniciales
    const pParts = nombrePaciente.split(' ');
    const ini = ((pParts[0]?.[0] || '') + (pParts[1]?.[0] || '')).toUpperCase() || 'PA';

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
          // Fallback en memoria
          this.appointmentService.citas.update(prev =>
            prev.map(c => c.id_cita === citaId ? {
              ...c,
              ...updateData,
              paciente_nombre: nombrePaciente,
              paciente_ci: ciPaciente,
              paciente_iniciales: ini,
              medico_nombre: nombreMedico,
              especialidad_nombre: espMedico
            } as Cita : c)
          );
          this.mostrarAlerta('success', '¡Cita actualizada exitosamente!');
          this.cancelarEdicion();
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
          // Fallback en memoria si el backend está offline
          const idSimulado = Date.now();
          const demoNueva: Cita = {
            id_cita: idSimulado,
            id_paciente: createData.id_paciente,
            id_medico: createData.id_medico,
            fecha_cita: createData.fecha_cita,
            hora_inicio: createData.hora_inicio,
            motivo: createData.motivo,
            estado: createData.estado || 'CONFIRMADA',
            tipo_consulta: createData.tipo_consulta || 'TELEMEDICINA',
            paciente_nombre: nombrePaciente,
            paciente_ci: ciPaciente,
            paciente_iniciales: ini,
            medico_nombre: nombreMedico,
            especialidad_nombre: espMedico,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.appointmentService.citas.update(prev => [demoNueva, ...prev]);
          this.mostrarAlerta('success', '¡Cita agendada y añadida automáticamente a la tabla!');
          this.cancelarEdicion();
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
        // Fallback en memoria si la BD está offline
        this.appointmentService.citas.update(prev => prev.filter(c => c.id_cita !== cita.id_cita));
        this.mostrarAlerta('success', `La cita de ${cita.paciente_nombre} ha sido eliminada dinámicamente.`);
        this.cerrarModalEliminar();
      }
    });
  }

  mostrarAlerta(type: 'success' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => {
      this.alertMessage.set(null);
    }, 4000);
  }

  formatearFechaDisplay(fechaStr: string): string {
    if (!fechaStr) return '';
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

  formatearHoraDisplay(hora: string): string {
    if (!hora) return '';
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
