import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FichaService } from '../../../../core/services/ficha.service';
import { FichaClinica, FichaClinicaUpdateRequest } from '../../../../core/models/ficha.models';
import { CIE10_CATALOGO } from '../../hce/data/cie10-catalog';
import { Cie10Item } from '../../../../core/models/hce.models';

@Component({
  selector: 'app-ficha-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './ficha-detalle.html',
  styleUrls: ['./ficha-detalle.css'],
})
export class FichaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fichaService = inject(FichaService);
  private readonly fb = inject(FormBuilder);

  readonly ficha = this.fichaService.selectedFicha;
  readonly isLoading = this.fichaService.isLoading;

  isSaving = signal<boolean>(false);
  saveSuccess = signal<string | null>(null);
  saveError = signal<string | null>(null);

  // Catálogo CIE-10
  readonly cie10Catalogo = CIE10_CATALOGO;
  cie10SearchQuery = signal<string>('');
  selectedCie10 = signal<Cie10Item | null>(null);
  showCie10Dropdown = signal<boolean>(false);

  filteredCie10 = computed(() => {
    const q = this.cie10SearchQuery().toLowerCase().trim();
    if (!q) return this.cie10Catalogo.slice(0, 8);
    return this.cie10Catalogo
      .filter((item) =>
        item.codigo.toLowerCase().includes(q) ||
        item.descripcion.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)
      )
      .slice(0, 10);
  });

  // Formulario Clínico
  clinicaForm = this.fb.group({
    // Signos Vitales
    presion_arterial: [''],
    frecuencia_cardiaca: [null as number | null],
    frecuencia_respiratoria: [null as number | null],
    temperatura: [null as number | null],
    saturacion_oxigeno: [null as number | null],
    peso_kg: [null as number | null],
    talla_cm: [null as number | null],

    // Secciones Dinámicas JSONB
    tipo_plantilla: ['MEDICINA_GENERAL'],
    anamnesis: [''],
    examen_fisico: [''],
    antecedentes_relevantes: [''],

    // Campos especializados adicionales
    campo_especialidad_1: [''],
    campo_especialidad_2: [''],

    // Diagnóstico y Notas
    codigo_cie10: [''],
    diagnostico_descripcion: [''],
    notas_evolucion: [''],
  });

  imc = computed(() => {
    const peso = this.clinicaForm.get('peso_kg')?.value;
    const talla = this.clinicaForm.get('talla_cm')?.value;
    if (peso && talla && talla > 0) {
      const tallaMetros = talla / 100;
      return +(peso / (tallaMetros * tallaMetros)).toFixed(1);
    }
    return null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarFicha(id);
    }
  }

  cargarFicha(id: string): void {
    this.fichaService.obtenerFicha(id).subscribe({
      next: (f) => this.poblarFormulario(f),
      error: () => {
        this.saveError.set('No se pudo cargar la información de la ficha médica.');
      },
    });
  }

  poblarFormulario(f: FichaClinica): void {
    const sv = f.signos_vitales || {};
    const sd = f.secciones_dinamicas || {};

    let plantilla = sd['tipo_plantilla'] || 'MEDICINA_GENERAL';
    if (f.especialidad_nombre) {
      const espUpper = f.especialidad_nombre.toUpperCase();
      if (espUpper.includes('CARDIO')) plantilla = 'CARDIOLOGIA';
      else if (espUpper.includes('PEDIA')) plantilla = 'PEDIATRIA';
      else if (espUpper.includes('DERMA')) plantilla = 'DERMATOLOGIA';
    }

    this.clinicaForm.patchValue({
      presion_arterial: sv.presion_arterial || '',
      frecuencia_cardiaca: sv.frecuencia_cardiaca || null,
      frecuencia_respiratoria: sv.frecuencia_respiratoria || null,
      temperatura: sv.temperatura || null,
      saturacion_oxigeno: sv.saturacion_oxigeno || null,
      peso_kg: sv.peso_kg || null,
      talla_cm: sv.talla_cm || null,

      tipo_plantilla: plantilla,
      anamnesis: sd['anamnesis'] || '',
      examen_fisico: sd['examen_fisico'] || '',
      antecedentes_relevantes: sd['antecedentes_relevantes'] || '',
      campo_especialidad_1: sd['campo_especialidad_1'] || '',
      campo_especialidad_2: sd['campo_especialidad_2'] || '',

      codigo_cie10: f.codigo_cie10 || '',
      diagnostico_descripcion: f.diagnostico_descripcion || '',
      notas_evolucion: f.notas_evolucion || '',
    });

    if (f.codigo_cie10) {
      const found = this.cie10Catalogo.find((c) => c.codigo === f.codigo_cie10);
      if (found) {
        this.selectedCie10.set(found);
      }
    }
  }

  selectCie10(item: Cie10Item): void {
    this.selectedCie10.set(item);
    this.clinicaForm.patchValue({
      codigo_cie10: item.codigo,
      diagnostico_descripcion: item.descripcion,
    });
    this.showCie10Dropdown.set(false);
  }

  clearCie10(): void {
    this.selectedCie10.set(null);
    this.clinicaForm.patchValue({
      codigo_cie10: '',
      diagnostico_descripcion: '',
    });
  }

  guardarClinica(finalizar: boolean = false): void {
    const currentFicha = this.ficha();
    if (!currentFicha) return;

    this.isSaving.set(true);
    this.saveSuccess.set(null);
    this.saveError.set(null);

    const val = this.clinicaForm.value;

    const signosVitales: any = {};
    if (val.presion_arterial) signosVitales.presion_arterial = val.presion_arterial;
    if (val.frecuencia_cardiaca) signosVitales.frecuencia_cardiaca = Number(val.frecuencia_cardiaca);
    if (val.frecuencia_respiratoria) signosVitales.frecuencia_respiratoria = Number(val.frecuencia_respiratoria);
    if (val.temperatura) signosVitales.temperatura = Number(val.temperatura);
    if (val.saturacion_oxigeno) signosVitales.saturacion_oxigeno = Number(val.saturacion_oxigeno);
    if (val.peso_kg) signosVitales.peso_kg = Number(val.peso_kg);
    if (val.talla_cm) signosVitales.talla_cm = Number(val.talla_cm);
    if (this.imc()) signosVitales.imc = this.imc();

    const seccionesDinamicas: any = {
      tipo_plantilla: val.tipo_plantilla,
      anamnesis: val.anamnesis || '',
      examen_fisico: val.examen_fisico || '',
      antecedentes_relevantes: val.antecedentes_relevantes || '',
    };
    if (val.campo_especialidad_1) seccionesDinamicas.campo_especialidad_1 = val.campo_especialidad_1;
    if (val.campo_especialidad_2) seccionesDinamicas.campo_especialidad_2 = val.campo_especialidad_2;

    const payload: FichaClinicaUpdateRequest = {
      signos_vitales: signosVitales,
      secciones_dinamicas: seccionesDinamicas,
      codigo_cie10: val.codigo_cie10 || undefined,
      diagnostico_descripcion: val.diagnostico_descripcion || undefined,
      notas_evolucion: val.notas_evolucion || undefined,
      estado: finalizar ? 'FINALIZADA' : (currentFicha.estado === 'EMITIDA' ? 'EN_ATENCION' : currentFicha.estado),
    };

    this.fichaService.actualizarClinica(currentFicha.id_ficha, payload).subscribe({
      next: (actualizada) => {
        this.isSaving.set(false);
        this.saveSuccess.set(
          finalizar
            ? '¡Atención médica finalizada con éxito y expediente cerrado!'
            : '¡Avance clínico registrado correctamente!'
        );
      },
      error: (err) => {
        this.isSaving.set(false);
        this.saveError.set(
          err.error?.detail || 'Error al guardar la información clínica.'
        );
      },
    });
  }

  getStatusBadgeClass(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'EMITIDA':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EN_ATENCION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FINALIZADA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELADA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }
}
