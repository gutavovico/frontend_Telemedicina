import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { PrescriptionsService } from '../../services/prescriptions.service';
import {
  RecetaCreateRequest,
  RecetaDetalleCreate,
  RecetaResponse,
  ViaAdministracion,
  diasHastaVencimiento,
  esLineaXorValida,
  generarIdempotencyKey,
} from '../../models/prescription.models';
import {
  MedicineLineEditor,
  MedicineLineFormGroup,
} from '../../components/medicine-line-editor/medicine-line-editor';

function xorMedicamentoValidator(control: AbstractControl): ValidationErrors | null {
  const grupo = control as MedicineLineFormGroup;
  const id = grupo.controls.id_medicamento?.value ?? null;
  const manual = grupo.controls.nombre_medicamento_manual?.value ?? null;
  const linea: Pick<RecetaDetalleCreate, 'id_medicamento' | 'nombre_medicamento_manual'> = {
    id_medicamento: id,
    nombre_medicamento_manual: manual,
  };
  return esLineaXorValida(linea) ? null : { xorMedicamento: true };
}

/**
 * Interpreta un query param como identificador clínico: entero positivo.
 * Cualquier valor ausente, no numérico o fuera de rango retorna null.
 */
function parsearIdClinico(valor: string | null): number | null {
  if (valor === null || valor.trim() === '') {
    return null;
  }
  const numero = Number(valor.trim());
  if (!Number.isInteger(numero) || numero <= 0) {
    return null;
  }
  return numero;
}

function vigenciaValidator(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  if (!valor) {
    return null;
  }
  const dias = diasHastaVencimiento(valor);
  if (dias === null || dias < 1 || dias > 90) {
    return { vigenciaRango: true };
  }
  return null;
}

@Component({
  selector: 'app-prescription-issue',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, Header, Footer, MedicineLineEditor],
  templateUrl: './prescription-issue.html',
  styleUrl: './prescription-issue.css',
})
export class PrescriptionIssue implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly service = inject(PrescriptionsService);

  readonly form = this.fb.group({
    id_consulta: this.fb.control<number>(0, {
      validators: [Validators.required, Validators.min(1)],
    }),
    id_paciente: this.fb.control<number>(0, {
      validators: [Validators.required, Validators.min(1)],
    }),
    fecha_vencimiento: this.fb.control<string>('', {
      validators: [Validators.required, vigenciaValidator],
    }),
    indicaciones_generales: this.fb.control<string | null>(null),
    detalles: this.fb.array<MedicineLineFormGroup>([], {
      validators: [Validators.required, Validators.minLength(1)],
    }),
  });

  readonly isSubmitting = signal<boolean>(false);
  readonly submitError = signal<string | null>(null);
  readonly submitErrorCode = signal<string | null>(null);
  readonly idempotencyKey = signal<string>(generarIdempotencyKey());

  // Contexto clínico (CU16, hallazgo 4): id_consulta e id_paciente llegan por
  // query params desde la HCE. Solo un contexto válido habilita la emisión; los
  // valores se fijan en el formulario tipado y sus controles se deshabilitan
  // para impedir la edición manual de IDs. Sin tenant en ningún caso.
  readonly contextoClinicoValido = signal<boolean>(false);
  readonly contextoConsultaId = signal<number | null>(null);
  readonly contextoPacienteId = signal<number | null>(null);

  private lastFailedPayload: string | null = null;

  get detalles(): FormArray<MedicineLineFormGroup> {
    return this.form.controls.detalles;
  }

  ngOnInit(): void {
    // Emisión exclusiva del médico (CU16, hallazgo 3): ADMIN, paciente y rol
    // desconocido no pueden abrir el formulario. El backend exige además
    // `prescriptions:issue` como autoridad final.
    if (this.authService.userRole() !== 'doctor') {
      void this.router.navigate(['/']);
      return;
    }
    this.aplicarContextoClinico();
    if (this.detalles.length === 0) {
      this.agregarLinea();
    }
  }

  private aplicarContextoClinico(): void {
    const consulta = parsearIdClinico(this.route.snapshot.queryParamMap.get('id_consulta'));
    const paciente = parsearIdClinico(this.route.snapshot.queryParamMap.get('id_paciente'));
    if (consulta === null || paciente === null) {
      this.contextoClinicoValido.set(false);
      this.contextoConsultaId.set(null);
      this.contextoPacienteId.set(null);
      return;
    }
    this.contextoClinicoValido.set(true);
    this.contextoConsultaId.set(consulta);
    this.contextoPacienteId.set(paciente);
    this.form.controls.id_consulta.setValue(consulta);
    this.form.controls.id_paciente.setValue(paciente);
    this.form.controls.id_consulta.disable();
    this.form.controls.id_paciente.disable();
  }

  crearLinea(): MedicineLineFormGroup {
    return this.fb.group(
      {
        modo: this.fb.control<'catalogo' | 'manual'>('catalogo'),
        id_medicamento: this.fb.control<number | null>(null),
        nombre_medicamento_manual: this.fb.control<string | null>(null),
        dosis: this.fb.control<string>('', {
          validators: [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
        }),
        frecuencia: this.fb.control<string>('', {
          validators: [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
        }),
        duracion: this.fb.control<string>('', {
          validators: [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
        }),
        via_administracion: this.fb.control<ViaAdministracion>('ORAL', {
          validators: [Validators.required],
        }),
        cantidad: this.fb.control<number>(1, {
          validators: [Validators.required, Validators.min(1)],
        }),
        indicaciones: this.fb.control<string | null>(null),
      },
      { validators: [xorMedicamentoValidator] },
    );
  }

  agregarLinea(): void {
    this.detalles.push(this.crearLinea());
  }

  retirarLinea(index: number): void {
    if (this.detalles.length <= 1) {
      return;
    }
    this.detalles.removeAt(index);
  }

  construirPayload(): RecetaCreateRequest {
    const crudo = this.form.getRawValue();
    return {
      id_consulta: Number(crudo.id_consulta),
      id_paciente: Number(crudo.id_paciente),
      fecha_vencimiento: String(crudo.fecha_vencimiento),
      indicaciones_generales:
        crudo.indicaciones_generales && crudo.indicaciones_generales.trim() !== ''
          ? crudo.indicaciones_generales.trim()
          : null,
      detalles: crudo.detalles.map((linea) => {
        const manual = (linea.nombre_medicamento_manual ?? '').trim();
        return {
          id_medicamento: linea.modo === 'catalogo' ? (linea.id_medicamento ?? null) : null,
          nombre_medicamento_manual:
            linea.modo === 'manual' ? (manual !== '' ? manual : null) : null,
          dosis: (linea.dosis ?? '').trim(),
          frecuencia: (linea.frecuencia ?? '').trim(),
          duracion: (linea.duracion ?? '').trim(),
          via_administracion: (linea.via_administracion ?? 'ORAL') as ViaAdministracion,
          cantidad: Number(linea.cantidad ?? 0),
          indicaciones:
            linea.indicaciones && linea.indicaciones.trim() !== ''
              ? linea.indicaciones.trim()
              : null,
        };
      }),
    };
  }

  emitir(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.submitError.set(null);
    this.submitErrorCode.set(null);
    // Sin contexto clínico válido no se permite emitir con IDs arbitrarios.
    if (!this.contextoClinicoValido()) {
      this.submitError.set(
        'Abra la emisión desde una consulta registrada para obtener el contexto clínico.',
      );
      return;
    }
    if (this.form.invalid || this.detalles.length === 0) {
      this.form.markAllAsTouched();
      this.detalles.controls.forEach((linea) => linea.markAllAsTouched());
      this.submitError.set('Revise los campos marcados. Se requiere al menos una línea válida.');
      return;
    }

    const payload = this.construirPayload();
    const payloadJson = JSON.stringify(payload);
    if (this.lastFailedPayload !== null && payloadJson !== this.lastFailedPayload) {
      this.idempotencyKey.set(generarIdempotencyKey());
    }

    this.isSubmitting.set(true);
    this.service.issuePrescription(payload, this.idempotencyKey()).subscribe({
      next: (resp: HttpResponse<RecetaResponse>) => {
        this.isSubmitting.set(false);
        const receta = resp.body;
        if (receta && (resp.status === 201 || resp.status === 200)) {
          this.lastFailedPayload = null;
          void this.router.navigate(['/recetas', receta.id_receta]);
        } else if (receta) {
          this.lastFailedPayload = null;
          void this.router.navigate(['/recetas', receta.id_receta]);
        } else {
          this.lastFailedPayload = payloadJson;
          this.submitError.set('Respuesta inesperada del servidor.');
        }
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.lastFailedPayload = payloadJson;
        const traducido = this.traducirError(err);
        this.submitError.set(traducido.detail);
        this.submitErrorCode.set(traducido.code);
      },
    });
  }

  private traducirError(err: unknown): { detail: string; code: string | null; status: number } {
    if (err instanceof HttpErrorResponse) {
      let detail = 'No se pudo emitir la receta.';
      let code: string | null = null;
      const body = err.error as unknown;
      if (typeof body === 'object' && body !== null) {
        const registro = body as Record<string, unknown>;
        if (typeof registro['detail'] === 'string') {
          detail = registro['detail'];
        }
        if (typeof registro['code'] === 'string') {
          code = registro['code'];
        }
      } else if (typeof body === 'string' && body.trim() !== '') {
        detail = body;
      }
      if (err.status === 422 && !code) {
        detail = detail || 'La vigencia excede el máximo permitido por la clínica.';
      }
      return { detail, code, status: err.status };
    }
    return { detail: 'Error de conexión. Intente nuevamente.', code: null, status: 0 };
  }
}
