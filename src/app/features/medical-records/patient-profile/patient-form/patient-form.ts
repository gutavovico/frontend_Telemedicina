import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PatientService } from '../../../../core/services/patient.service';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, Header, Footer],
  templateUrl: './patient-form.html',
  styleUrl: './patient-form.css'
})
export class PatientForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly patientService = inject(PatientService);

  form!: FormGroup;
  isEditMode = signal<boolean>(false);
  patientId = signal<number | null>(null);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.initForm();
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode.set(true);
      this.patientId.set(Number(idParam));
      this.loadPatientData(Number(idParam));
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      apellidos: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      ci: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      complemento: ['', [Validators.maxLength(10)]],
      fecha_nacimiento: ['', [Validators.required]],
      genero: ['M', [Validators.required]],
      telefono: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
      correo: ['', [Validators.email]],
      direccion: ['', [Validators.maxLength(255)]],
      ciudad: ['Santa Cruz de la Sierra', [Validators.maxLength(100)]],
      tipo_sangre: [''],
      alergias: [''],
      antecedentes_patologicos: [''],
      contacto_emergencia_nombre: ['', [Validators.maxLength(150)]],
      contacto_emergencia_telefono: ['', [Validators.maxLength(20)]],
      contacto_emergencia_parentesco: ['', [Validators.maxLength(50)]],
      seguro_medico: ['', [Validators.maxLength(100)]],
      numero_seguro: ['', [Validators.maxLength(50)]],
      estado: ['ACTIVO']
    });
  }

  private loadPatientData(id: number): void {
    this.patientService.getPatientById(id).subscribe({
      next: (patient) => {
        this.form.patchValue({
          nombres: patient.nombres,
          apellidos: patient.apellidos,
          ci: patient.ci,
          complemento: patient.complemento || '',
          fecha_nacimiento: patient.fecha_nacimiento,
          genero: patient.genero,
          telefono: patient.telefono,
          correo: patient.correo || '',
          direccion: patient.direccion || '',
          ciudad: patient.ciudad || 'Santa Cruz de la Sierra',
          tipo_sangre: patient.tipo_sangre || '',
          alergias: patient.alergias || '',
          antecedentes_patologicos: patient.antecedentes_patologicos || '',
          contacto_emergencia_nombre: patient.contacto_emergencia_nombre || '',
          contacto_emergencia_telefono: patient.contacto_emergencia_telefono || '',
          contacto_emergencia_parentesco: patient.contacto_emergencia_parentesco || '',
          seguro_medico: patient.seguro_medico || '',
          numero_seguro: patient.numero_seguro || '',
          estado: patient.estado
        });
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la información del paciente.');
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Por favor complete todos los campos obligatorios requeridos.');
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formValues = this.form.value;

    if (this.isEditMode() && this.patientId()) {
      this.patientService.updatePatient(this.patientId()!, formValues).subscribe({
        next: () => {
          this.successMessage.set('Expediente del paciente actualizado correctamente.');
          setTimeout(() => {
            this.router.navigate(['/pacientes', this.patientId()]);
          }, 1500);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.detail || 'Error al actualizar el paciente.');
        }
      });
    } else {
      this.patientService.createPatient(formValues).subscribe({
        next: (created) => {
          this.successMessage.set('Paciente registrado exitosamente en el sistema.');
          setTimeout(() => {
            this.router.navigate(['/pacientes', created.id_paciente]);
          }, 1500);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.detail || 'Error al registrar el paciente.');
        }
      });
    }
  }
}
