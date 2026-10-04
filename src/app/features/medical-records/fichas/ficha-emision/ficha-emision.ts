import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FichaService } from '../../../../core/services/ficha.service';
import { AppointmentService } from '../../../../core/services/appointment.service';
import { PatientService } from '../../../../core/services/patient.service';
import { FichaCreateRequest } from '../../../../core/models/ficha.models';
import { HorarioSlot } from '../../../../core/models/appointment.models';

interface DoctorOption {
  id_medico: number;
  nombre: string;
  especialidad: string;
  id_especialidad: number;
}

interface PatientOption {
  id_paciente: number;
  nombre: string;
  ci: string;
}

interface SlotFicha {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

@Component({
  selector: 'app-ficha-emision',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './ficha-emision.html',
  styleUrls: ['./ficha-emision.css'],
})
export class FichaEmisionComponent implements OnInit {
  private readonly fichaService = inject(FichaService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly patientService = inject(PatientService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Estados reactivos
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  conflictError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Pacientes y Médicos
  pacientes = signal<PatientOption[]>([]);
  medicos = signal<DoctorOption[]>([
    { id_medico: 1, nombre: 'Dr. Carlos Mendoza', especialidad: 'Cardiología', id_especialidad: 1 },
    { id_medico: 2, nombre: 'Dra. Elena Ruiz', especialidad: 'Pediatría', id_especialidad: 2 },
    { id_medico: 3, nombre: 'Dr. Roberto Fernandez', especialidad: 'Medicina General', id_especialidad: 3 },
    { id_medico: 4, nombre: 'Dra. Sofia Vaca', especialidad: 'Dermatología', id_especialidad: 4 },
  ]);

  // Horarios / Slots
  slotsDisponibles = signal<SlotFicha[]>([]);
  selectedSlot = signal<string | null>(null);
  isLoadingSlots = signal<boolean>(false);

  // Formulario reactivo
  form = this.fb.group({
    id_paciente: [1, [Validators.required]],
    id_medico: [1, [Validators.required]],
    id_especialidad: [1],
    fecha_atencion: [new Date().toISOString().split('T')[0], [Validators.required]],
    hora_inicio: ['', [Validators.required]],
    hora_fin: ['', [Validators.required]],
    motivo_consulta: ['', [Validators.required, Validators.minLength(4)]],

    // Signos Vitales preliminares (Opcionales)
    presion_arterial: [''],
    frecuencia_cardiaca: [null as number | null],
    temperatura: [null as number | null],
    peso_kg: [null as number | null],
    talla_cm: [null as number | null],
  });

  // Cálculo de IMC reactivo
  imcCalculado = computed(() => {
    const peso = this.form.get('peso_kg')?.value;
    const talla = this.form.get('talla_cm')?.value;
    if (peso && talla && talla > 0) {
      const tallaMetros = talla / 100;
      return +(peso / (tallaMetros * tallaMetros)).toFixed(1);
    }
    return null;
  });

  ngOnInit(): void {
    this.cargarPacientes();
    this.cargarSlots();

    // Escuchar cambios de médico o fecha para refrescar slots
    this.form.get('id_medico')?.valueChanges.subscribe((id) => {
      const doc = this.medicos().find((m) => m.id_medico === Number(id));
      if (doc) {
        this.form.get('id_especialidad')?.setValue(doc.id_especialidad);
      }
      this.cargarSlots();
    });

    this.form.get('fecha_atencion')?.valueChanges.subscribe(() => {
      this.cargarSlots();
    });
  }

  cargarPacientes(): void {
    this.patientService.getPatients().subscribe({
      next: (res) => {
        if (res && res.items) {
          this.pacientes.set(
            res.items.map((p) => ({
              id_paciente: p.id_paciente,
              nombre: `${p.nombres} ${p.apellidos}`.trim(),
              ci: p.ci,
            }))
          );
        }
      },
      error: () => {
        // Fallback predeterminado
        this.pacientes.set([
          { id_paciente: 1, nombre: 'María Rodríguez', ci: '1234567' },
          { id_paciente: 2, nombre: 'Juan Carlos Gómez', ci: '2345678' },
          { id_paciente: 3, nombre: 'Ana López', ci: '3456789' },
        ]);
      },
    });
  }

  cargarSlots(): void {
    const idMedico = Number(this.form.get('id_medico')?.value) || 1;
    const fecha = this.form.get('fecha_atencion')?.value || new Date().toISOString().split('T')[0];

    this.isLoadingSlots.set(true);
    this.selectedSlot.set(null);
    this.form.patchValue({ hora_inicio: '', hora_fin: '' });

    this.appointmentService.obtenerHorarios(idMedico, fecha).subscribe({
      next: (slots) => {
        const mapped: SlotFicha[] = (slots || []).map((s) => ({
          hora_inicio: s.hora_inicio || s.hora,
          hora_fin: s.hora_fin || s.hora,
          disponible: s.disponible,
        }));
        this.slotsDisponibles.set(mapped);
        this.isLoadingSlots.set(false);
      },
      error: () => {
        // Slots simulados si el backend no cuenta con horarios registrados para ese médico
        const fallbackSlots: SlotFicha[] = [
          { hora_inicio: '08:00', hora_fin: '08:30', disponible: true },
          { hora_inicio: '08:30', hora_fin: '09:00', disponible: true },
          { hora_inicio: '09:00', hora_fin: '09:30', disponible: true },
          { hora_inicio: '09:30', hora_fin: '10:00', disponible: true },
          { hora_inicio: '10:00', hora_fin: '10:30', disponible: true },
          { hora_inicio: '10:30', hora_fin: '11:00', disponible: true },
          { hora_inicio: '11:00', hora_fin: '11:30', disponible: true },
          { hora_inicio: '11:30', hora_fin: '12:00', disponible: true },
          { hora_inicio: '14:00', hora_fin: '14:30', disponible: true },
          { hora_inicio: '14:30', hora_fin: '15:00', disponible: true },
          { hora_inicio: '15:00', hora_fin: '15:30', disponible: true },
        ];
        this.slotsDisponibles.set(fallbackSlots);
        this.isLoadingSlots.set(false);
      },
    });
  }

  selectSlot(slot: SlotFicha): void {
    if (!slot.disponible) return;
    this.selectedSlot.set(slot.hora_inicio);
    this.form.patchValue({
      hora_inicio: slot.hora_inicio,
      hora_fin: slot.hora_fin,
    });
    this.conflictError.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.conflictError.set(null);

    const val = this.form.value;

    const signosVitales: any = {};
    if (val.presion_arterial) signosVitales.presion_arterial = val.presion_arterial;
    if (val.frecuencia_cardiaca) signosVitales.frecuencia_cardiaca = Number(val.frecuencia_cardiaca);
    if (val.temperatura) signosVitales.temperatura = Number(val.temperatura);
    if (val.peso_kg) signosVitales.peso_kg = Number(val.peso_kg);
    if (val.talla_cm) signosVitales.talla_cm = Number(val.talla_cm);
    if (this.imcCalculado()) signosVitales.imc = this.imcCalculado();

    const payload: FichaCreateRequest = {
      id_paciente: Number(val.id_paciente),
      id_medico: Number(val.id_medico),
      id_especialidad: val.id_especialidad ? Number(val.id_especialidad) : undefined,
      fecha_atencion: val.fecha_atencion!,
      hora_inicio: val.hora_inicio!,
      hora_fin: val.hora_fin!,
      motivo_consulta: val.motivo_consulta!,
      signos_vitales: Object.keys(signosVitales).length > 0 ? signosVitales : {},
      secciones_dinamicas: {},
    };

    this.fichaService.emitirFicha(payload).subscribe({
      next: (nuevaFicha) => {
        this.isSubmitting.set(false);
        this.successMessage.set(
          `¡Ficha ${nuevaFicha.correlativo} emitida con éxito! Redirigiendo al expediente...`
        );
        setTimeout(() => {
          this.router.navigate(['/fichas', nuevaFicha.id_ficha]);
        }, 1200);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          const detail =
            err.error?.detail ||
            'El turno seleccionado ya se encuentra ocupado por otra ficha médica o cita clínica.';
          this.conflictError.set(detail);
        } else {
          this.errorMessage.set(
            err.error?.detail || 'Ocurrió un error al procesar la emisión de la ficha médica.'
          );
        }
      },
    });
  }
}
