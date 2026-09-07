import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  FormsModule
} from '@angular/forms';
import { HceService } from '../../../../core/services/hce.service';
import { PatientService } from '../../../../core/services/patient.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import {
  ConsultaCreateRequest,
  DiagnosticoCreate,
  TipoDiagnostico,
  Cie10Item
} from '../../../../core/models/hce.models';
import { buscarCie10 } from '../data/cie10-catalog';

@Component({
  selector: 'app-consulta-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, Header, Footer],
  templateUrl: './consulta-editor.html',
  styleUrl: './consulta-editor.css'
})
export class ConsultaEditor implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly hceService = inject(HceService);
  readonly patientService = inject(PatientService);
  readonly authService = inject(AuthService);

  readonly idPaciente = signal<number>(0);
  readonly idCita = signal<number>(0);

  // Lista dinámica de diagnósticos CIE-10 asignados a esta consulta
  readonly diagnosticos = signal<DiagnosticoCreate[]>([]);

  // Búsqueda interactiva CIE-10
  readonly terminoBusquedaCie = signal<string>('');
  readonly tipoDiagnosticoSeleccionado = signal<TipoDiagnostico>('DEFINITIVO');
  readonly sugerenciasCie = computed(() => buscarCie10(this.terminoBusquedaCie()));

  // Formulario reactivo fuertemente tipado alineado a Pydantic
  readonly form = this.fb.group({
    id_cita: [0, [Validators.required, Validators.min(1)]],
    motivo_consulta: ['', [Validators.required, Validators.minLength(5)]],
    sintomas: ['', [Validators.required, Validators.minLength(5)]],
    examen_fisico: [''],
    // Signos Vitales
    presion_sistolica_mmhg: [null as number | null, [Validators.min(50), Validators.max(260)]],
    presion_diastolica_mmhg: [null as number | null, [Validators.min(30), Validators.max(160)]],
    frecuencia_cardiaca_lpm: [null as number | null, [Validators.min(30), Validators.max(250)]],
    temperatura_corporal_c: [null as number | null, [Validators.min(30.0), Validators.max(45.0)]],
    saturacion_oxigeno_pct: [null as number | null, [Validators.min(50), Validators.max(100)]],
    peso_kg: [null as number | null, [Validators.min(1.0), Validators.max(350.0)]],
    talla_cm: [null as number | null, [Validators.min(30.0), Validators.max(250.0)]],
    // SOAP y Plan
    evolucion: ['', [Validators.required, Validators.minLength(10)]],
    plan_medico: ['', [Validators.required, Validators.minLength(5)]],
    observaciones: ['']
  });

  // Cálculo reactivo del IMC
  readonly imcCalculado = computed(() => {
    const peso = this.form.controls.peso_kg.value;
    const talla = this.form.controls.talla_cm.value;
    if (peso && talla && talla > 0) {
      const tallaM = talla / 100;
      const imc = peso / (tallaM * tallaM);
      return Math.round(imc * 100) / 100;
    }
    return null;
  });

  // Alerta reactiva de presión arterial
  readonly alertaPresion = computed(() => {
    const sis = this.form.controls.presion_sistolica_mmhg.value;
    const dia = this.form.controls.presion_diastolica_mmhg.value;
    if (!sis || !dia) return null;
    if (sis >= 140 || dia >= 90) {
      return { nivel: 'CRITICO', texto: 'Hipertensión / Alerta Clínica', color: 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]' };
    }
    if (sis >= 120 || dia >= 80) {
      return { nivel: 'ALTO', texto: 'Prehipertensión / Observación', color: 'bg-amber-50 text-amber-800 border-amber-300' };
    }
    return { nivel: 'NORMAL', texto: 'Presión Arterial Normal', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
  });

  // Alerta reactiva de temperatura
  readonly alertaTemperatura = computed(() => {
    const temp = this.form.controls.temperatura_corporal_c.value;
    if (!temp) return null;
    if (temp >= 37.5) {
      return { nivel: 'CRITICO', texto: 'Febrícula / Fiebre', color: 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]' };
    }
    if (temp < 35.5) {
      return { nivel: 'ALTO', texto: 'Hipotermia', color: 'bg-cyan-50 text-cyan-800 border-cyan-300' };
    }
    return { nivel: 'NORMAL', texto: 'Afebril (Normal)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
  });

  // Alerta reactiva de oxígeno
  readonly alertaSpo2 = computed(() => {
    const spo2 = this.form.controls.saturacion_oxigeno_pct.value;
    if (!spo2) return null;
    if (spo2 < 90) {
      return { nivel: 'CRITICO', texto: 'Hipoxia Severa', color: 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]' };
    }
    if (spo2 < 95) {
      return { nivel: 'ALTO', texto: 'Hipoxia Leve', color: 'bg-amber-50 text-amber-800 border-amber-300' };
    }
    return { nivel: 'NORMAL', texto: 'Saturación Óptima', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
  });

  ngOnInit(): void {
    // Validar acceso exclusivo a médicos
    if (!this.authService.isDoctor()) {
      this.router.navigate(['/']);
      return;
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.idPaciente.set(id);
      this.patientService.getPatientById(id).subscribe();
      this.hceService.getHistoriaClinica(id).subscribe();
    }

    // Tomar id_cita si viene por query param (ej: ?id_cita=1)
    const citaQuery = this.route.snapshot.queryParamMap.get('id_cita');
    if (citaQuery) {
      const citaId = Number(citaQuery);
      this.idCita.set(citaId);
      this.form.controls.id_cita.setValue(citaId);
    }
  }

  agregarDiagnostico(item: Cie10Item): void {
    // Evitar duplicados por código
    const yaExiste = this.diagnosticos().some(d => d.codigo_cie === item.codigo);
    if (yaExiste) {
      return;
    }

    const nuevoDiag: DiagnosticoCreate = {
      codigo_cie: item.codigo,
      descripcion: item.descripcion,
      tipo: this.tipoDiagnosticoSeleccionado(),
      observaciones: ''
    };

    this.diagnosticos.update(list => [...list, nuevoDiag]);
    this.terminoBusquedaCie.set('');
  }

  eliminarDiagnostico(index: number): void {
    this.diagnosticos.update(list => list.filter((_, i) => i !== index));
  }

  cambiarTipoDiagnostico(index: number, nuevoTipo: TipoDiagnostico): void {
    this.diagnosticos.update(list => {
      const copia = [...list];
      copia[index] = { ...copia[index], tipo: nuevoTipo };
      return copia;
    });
  }

  guardarConsulta(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.diagnosticos().length === 0) {
      return; // Bloqueado por regla de negocio
    }

    const val = this.form.getRawValue();

    // Armar signos vitales sólo si se ingresó algún dato
    const tieneSignos =
      val.presion_sistolica_mmhg ||
      val.presion_diastolica_mmhg ||
      val.frecuencia_cardiaca_lpm ||
      val.temperatura_corporal_c ||
      val.saturacion_oxigeno_pct ||
      val.peso_kg ||
      val.talla_cm;

    const payload: ConsultaCreateRequest = {
      id_cita: Number(val.id_cita),
      motivo_consulta: val.motivo_consulta.trim(),
      sintomas: val.sintomas.trim(),
      examen_fisico: val.examen_fisico ? val.examen_fisico.trim() : null,
      signos_vitales: tieneSignos
        ? {
            presion_sistolica_mmhg: val.presion_sistolica_mmhg,
            presion_diastolica_mmhg: val.presion_diastolica_mmhg,
            frecuencia_cardiaca_lpm: val.frecuencia_cardiaca_lpm,
            temperatura_corporal_c: val.temperatura_corporal_c,
            saturacion_oxigeno_pct: val.saturacion_oxigeno_pct,
            peso_kg: val.peso_kg,
            talla_cm: val.talla_cm,
            indice_masa_corporal: this.imcCalculado()
          }
        : null,
      evolucion: val.evolucion.trim(),
      plan_medico: val.plan_medico.trim(),
      observaciones: val.observaciones ? val.observaciones.trim() : null,
      diagnosticos: this.diagnosticos()
    };

    this.hceService.registrarConsulta(this.idPaciente(), payload).subscribe({
      next: () => {
        // Redireccionar al historial cronológico del paciente
        this.router.navigate(['/pacientes', this.idPaciente(), 'hce']);
      }
    });
  }
}
