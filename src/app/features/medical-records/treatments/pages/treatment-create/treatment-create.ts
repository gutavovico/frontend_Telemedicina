import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { TreatmentsService } from '../../services/treatments.service';
import { PrescriptionsService } from '../../../prescriptions/services/prescriptions.service';
import { Plan, PlanCreate } from '../../models/treatment.models';

export interface FormMedicamentoItem {
  id_receta_detalle: number;
  medicamento_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  horas_locales: string[];
  indicaciones: string;
  frecuencia_receta?: string;
  nuevaHora?: string;
}

export type PresetFrecuencia = '24h' | '12h' | '8h' | '6h';

export const PRESETS_HORAS: Record<PresetFrecuencia, string[]> = {
  '24h': ['08:00'],
  '12h': ['08:00', '20:00'],
  '8h': ['00:00', '08:00', '16:00'],
  '6h': ['00:00', '06:00', '12:00', '18:00'],
};

export interface InfoEquidistancia {
  esEquidistante: boolean;
  texto: string;
  intervaloHoras: number | null;
}

/**
 * Calcula si las tomas programadas dentro de un ciclo de 24 horas son equidistantes.
 * Retorna texto descriptivo como 'Cada 8 horas', 'Cada 12 horas', etc.,
 * o 'Horario personalizado' si las diferencias entre tomas sucesivas difieren.
 */
export function calcularEquidistancia(horas: string[]): InfoEquidistancia {
  if (!horas || horas.length === 0) {
    return { esEquidistante: false, texto: 'Sin tomas', intervaloHoras: null };
  }
  if (horas.length === 1) {
    return { esEquidistante: true, texto: 'Cada 24 horas', intervaloHoras: 24 };
  }

  const minutos = horas
    .map((h) => {
      const parts = h.split(':');
      if (parts.length !== 2) return NaN;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    })
    .filter((m) => !isNaN(m))
    .sort((a, b) => a - b);

  if (minutos.length !== horas.length) {
    return { esEquidistante: false, texto: 'Hora inválida', intervaloHoras: null };
  }

  const n = minutos.length;
  const intervaloEsperado = 1440 / n;

  let esEqui = true;
  for (let i = 0; i < n - 1; i++) {
    const diff = minutos[i + 1] - minutos[i];
    if (Math.abs(diff - intervaloEsperado) > 0.001) {
      esEqui = false;
      break;
    }
  }

  if (esEqui) {
    const diffWrap = 1440 - minutos[n - 1] + minutos[0];
    if (Math.abs(diffWrap - intervaloEsperado) > 0.001) {
      esEqui = false;
    }
  }

  if (esEqui) {
    const horasInt = Math.round(intervaloEsperado / 60);
    if (intervaloEsperado % 60 === 0) {
      return {
        esEquidistante: true,
        texto: `Cada ${horasInt} horas`,
        intervaloHoras: horasInt,
      };
    } else {
      return {
        esEquidistante: true,
        texto: `Cada ${intervaloEsperado} min`,
        intervaloHoras: null,
      };
    }
  }

  return {
    esEquidistante: false,
    texto: 'Horario personalizado',
    intervaloHoras: null,
  };
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultEndDateString(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcularDias(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const d1 = new Date(inicio + 'T00:00:00');
  const d2 = new Date(fin + 'T00:00:00');
  const diff = d2.getTime() - d1.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

@Component({
  selector: 'app-treatment-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './treatment-create.html',
  styleUrl: './treatment-create.css',
})
export class TreatmentCreate implements OnInit {
  readonly authService = inject(AuthService);
  private readonly treatmentsService = inject(TreatmentsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly prescriptionsService = inject(PrescriptionsService, { optional: true });

  // Form Signals
  readonly idConsulta = signal<number | null>(null);
  readonly idReceta = signal<number | null>(null);
  readonly idDiagnostico = signal<number | null>(null);
  readonly fechaInicio = signal<string>(getTodayDateString());
  readonly fechaFin = signal<string>(getDefaultEndDateString(14));
  readonly zonaHoraria = signal<string>('America/La_Paz');
  readonly notas = signal<string>('');
  readonly tieneReceta = signal<boolean>(false);
  readonly medicamentos = signal<FormMedicamentoItem[]>([]);

  // UI state signals
  readonly isSubmitting = signal<boolean>(false);
  readonly isLoadingReceta = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Computed properties
  readonly duracionDias = computed(() => {
    return calcularDias(this.fechaInicio(), this.fechaFin());
  });

  ngOnInit(): void {
    // 1. Autorización: solo médico tratante
    if (!this.authService.isDoctor()) {
      this.errorMessage.set('Acceso denegado: Solo el médico tratante puede crear planes de tratamiento.');
      this.router.navigate(['/']);
      return;
    }

    // 2. Extracción de query parameters
    const queryParams = this.route.snapshot.queryParamMap;
    const consultaParam = queryParams.get('id_consulta');
    if (consultaParam) {
      const idC = parseInt(consultaParam, 10);
      if (!isNaN(idC) && idC > 0) {
        this.idConsulta.set(idC);
      }
    }

    const recetaParam = queryParams.get('id_receta');
    if (recetaParam) {
      const idR = parseInt(recetaParam, 10);
      if (!isNaN(idR) && idR > 0) {
        this.idReceta.set(idR);
        this.tieneReceta.set(true);
        this.cargarReceta();
      }
    }

    const diagParam = queryParams.get('id_diagnostico');
    if (diagParam) {
      const idD = parseInt(diagParam, 10);
      if (!isNaN(idD) && idD > 0) {
        this.idDiagnostico.set(idD);
      }
    }
  }

  onIdRecetaChange(valor: number | null): void {
    this.idReceta.set(valor);
    if (valor && valor > 0) {
      this.tieneReceta.set(true);
    } else {
      this.tieneReceta.set(false);
      this.medicamentos.set([]);
    }
  }

  cargarReceta(): void {
    const idR = this.idReceta();
    if (!idR || idR <= 0) {
      this.errorMessage.set('Debe ingresar un ID de receta válido para cargar medicamentos.');
      return;
    }
    if (!this.prescriptionsService) {
      return;
    }

    this.isLoadingReceta.set(true);
    this.errorMessage.set(null);

    this.prescriptionsService.getPrescription(idR).subscribe({
      next: (receta) => {
        this.isLoadingReceta.set(false);
        if (!receta.detalles || receta.detalles.length === 0) {
          this.errorMessage.set('La receta no tiene medicamentos asociados.');
          return;
        }
        const meds: FormMedicamentoItem[] = receta.detalles.map((d) => ({
          id_receta_detalle: d.id_receta_detalle,
          medicamento_nombre: d.medicamento_nombre || d.nombre_medicamento_manual || `Medicamento #${d.id_receta_detalle}`,
          fecha_inicio: this.fechaInicio(),
          fecha_fin: this.fechaFin(),
          horas_locales: [], // La regla de negocio exige selección o confirmación explícita del médico
          indicaciones: d.indicaciones || '',
          frecuencia_receta: d.frecuencia || '',
          nuevaHora: '',
        }));
        this.medicamentos.set(meds);
        this.tieneReceta.set(true);
        this.successMessage.set(
          `Se cargaron ${meds.length} medicamento(s) de la receta folio: ${receta.folio || idR}. Configure explícitamente el horario de cada fármaco antes de continuar.`
        );
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.isLoadingReceta.set(false);
        const detail = err?.error?.detail || err?.message || 'No se pudo cargar la receta.';
        this.errorMessage.set(`Error al obtener receta: ${detail}`);
      },
    });
  }

  aplicarPreset(medIndex: number, preset: PresetFrecuencia): void {
    const med = this.medicamentos()[medIndex];
    if (!med) return;
    const horas = [...PRESETS_HORAS[preset]];
    const list = [...this.medicamentos()];
    list[medIndex] = {
      ...med,
      horas_locales: horas,
    };
    this.medicamentos.set(list);
  }

  agregarHora(medIndex: number, hora: string): void {
    if (!hora || !hora.trim()) return;
    const h = hora.trim();
    const regex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!regex.test(h)) {
      this.errorMessage.set('La hora debe tener formato válido HH:mm (ej. 08:00, 14:30).');
      return;
    }
    const med = this.medicamentos()[medIndex];
    if (!med) return;
    if (med.horas_locales.includes(h)) {
      this.errorMessage.set(`La hora ${h} ya está programada.`);
      return;
    }
    if (med.horas_locales.length >= 24) {
      this.errorMessage.set('No se pueden programar más de 24 tomas por día.');
      return;
    }
    this.errorMessage.set(null);
    const updatedHoras = [...med.horas_locales, h].sort();
    const list = [...this.medicamentos()];
    list[medIndex] = {
      ...med,
      horas_locales: updatedHoras,
      nuevaHora: '',
    };
    this.medicamentos.set(list);
  }

  quitarHora(medIndex: number, horaIndex: number): void {
    const med = this.medicamentos()[medIndex];
    if (!med) return;
    const updatedHoras = med.horas_locales.filter((_, i) => i !== horaIndex);
    const list = [...this.medicamentos()];
    list[medIndex] = {
      ...med,
      horas_locales: updatedHoras,
    };
    this.medicamentos.set(list);
  }

  agregarMedicamento(): void {
    const nuevo: FormMedicamentoItem = {
      id_receta_detalle: this.medicamentos().length + 1,
      medicamento_nombre: '',
      fecha_inicio: this.fechaInicio(),
      fecha_fin: this.fechaFin(),
      horas_locales: [],
      indicaciones: '',
      frecuencia_receta: '',
      nuevaHora: '',
    };
    this.medicamentos.update((list) => [...list, nuevo]);
    this.tieneReceta.set(true);
  }

  eliminarMedicamento(medIndex: number): void {
    this.medicamentos.update((list) => list.filter((_, i) => i !== medIndex));
  }

  actualizarMedicamentoCampo<K extends keyof FormMedicamentoItem>(
    medIndex: number,
    campo: K,
    valor: FormMedicamentoItem[K]
  ): void {
    const list = [...this.medicamentos()];
    list[medIndex] = { ...list[medIndex], [campo]: valor };
    this.medicamentos.set(list);
  }

  obtenerEquidistancia(horas: string[]): InfoEquidistancia {
    return calcularEquidistancia(horas);
  }

  validarFormulario(): string | null {
    const idC = this.idConsulta();
    if (!idC || isNaN(idC) || idC <= 0) {
      return 'El ID de consulta es obligatorio y debe ser un número entero positivo.';
    }

    const inicio = this.fechaInicio();
    const fin = this.fechaFin();
    if (!inicio || !fin) {
      return 'Debe ingresar las fechas de inicio y fin del plan.';
    }

    if (fin < inicio) {
      return 'La fecha de fin debe ser mayor o igual a la fecha de inicio del plan.';
    }

    const diasPlan = calcularDias(inicio, fin);
    if (diasPlan > 366) {
      return `La duración del plan no puede exceder los 366 días (duración actual: ${diasPlan} días).`;
    }

    const idR = this.idReceta();
    const meds = this.medicamentos();

    if ((idR && idR > 0) || this.tieneReceta()) {
      if (meds.length === 0) {
        return 'Al asociar una receta, debe incluir al menos un medicamento en el plan.';
      }

      for (let i = 0; i < meds.length; i++) {
        const m = meds[i];
        const nombre = m.medicamento_nombre?.trim() || `Medicamento #${i + 1}`;
        if (!m.id_receta_detalle || m.id_receta_detalle <= 0) {
          return `${nombre}: debe tener un ID de detalle de receta válido.`;
        }
        if (!m.fecha_inicio || !m.fecha_fin) {
          return `${nombre}: debe tener fechas de inicio y fin definidas.`;
        }
        if (m.fecha_fin < m.fecha_inicio) {
          return `${nombre}: la fecha de fin no puede ser anterior a la fecha de inicio.`;
        }
        const diasMed = calcularDias(m.fecha_inicio, m.fecha_fin);
        if (diasMed > 366) {
          return `${nombre}: no puede exceder los 366 días de tratamiento.`;
        }
        if (!m.horas_locales || m.horas_locales.length === 0) {
          return `${nombre}: debe tener al menos una hora programada en el horario.`;
        }
        if (m.horas_locales.length > 24) {
          return `${nombre}: no puede tener más de 24 tomas programadas por día.`;
        }
        const regexHora = /^([01]\d|2[0-3]):[0-5]\d$/;
        for (const h of m.horas_locales) {
          if (!regexHora.test(h)) {
            return `${nombre}: la hora '${h}' no tiene un formato válido HH:mm.`;
          }
        }
        const unique = new Set(m.horas_locales);
        if (unique.size !== m.horas_locales.length) {
          return `${nombre}: no puede contener horas duplicadas en el horario.`;
        }
      }
    }

    return null;
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const error = this.validarFormulario();
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    const idRecetaVal = this.idReceta() && Number(this.idReceta()) > 0
      ? Number(this.idReceta())
      : null;

    const payload: PlanCreate = {
      id_consulta: Number(this.idConsulta()),
      id_receta: idRecetaVal,
      id_diagnostico: this.idDiagnostico() && Number(this.idDiagnostico()) > 0 ? Number(this.idDiagnostico()) : null,
      fecha_inicio: this.fechaInicio(),
      fecha_fin: this.fechaFin(),
      zona_horaria: this.zonaHoraria() || 'America/La_Paz',
      notas: this.notas()?.trim() || null,
      medicamentos: idRecetaVal ? this.medicamentos().map((m) => ({
        id_receta_detalle: Number(m.id_receta_detalle),
        fecha_inicio: m.fecha_inicio,
        fecha_fin: m.fecha_fin,
        horas_locales: [...m.horas_locales].sort(),
        indicaciones: m.indicaciones?.trim() || null,
      })) : [],
    };

    this.isSubmitting.set(true);

    this.treatmentsService.createPlan(payload).subscribe({
      next: (plan: Plan) => {
        this.isSubmitting.set(false);
        this.successMessage.set(`Plan de tratamiento #${plan.id_tratamiento} creado exitosamente.`);
        this.router.navigate(['/tratamientos', plan.id_tratamiento]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const detail = err?.error?.detail || err?.message || 'Error al registrar el plan de tratamiento.';
        this.errorMessage.set(detail);
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/consultas']);
  }
}
