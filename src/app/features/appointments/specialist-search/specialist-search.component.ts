import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SpecialistSearchService } from './services/specialist-search.service';
import {
  EspecialidadItem,
  EspecialistaItem,
  SpecialistSearchResponse,
} from './models/specialist-search.model';

@Component({
  selector: 'app-specialist-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './specialist-search.component.html',
  styleUrls: ['./specialist-search.component.css'],
})
export class SpecialistSearchComponent implements OnInit {
  private readonly fb: FormBuilder;
  private readonly searchService: SpecialistSearchService;

  readonly searchForm: FormGroup;
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly results = signal<SpecialistSearchResponse | null>(null);
  readonly selectedSpecialist = signal<EspecialistaItem | null>(null);
  readonly especialidades = signal<EspecialidadItem[]>([]);

  // Solución contra respuestas atrasadas (race conditions)
  private currentRequestId = 0;

  constructor(fb?: FormBuilder, searchService?: SpecialistSearchService) {
    this.fb = fb ?? inject(FormBuilder);
    this.searchService = searchService ?? inject(SpecialistSearchService);

    this.searchForm = this.fb.group({
      nombre: [''],
      especialidad_id: [''],
      modalidad: ['AMBAS'],
      costo_min: [''],
      costo_max: [''],
      fecha_inicio: ['', Validators.required],
      fecha_fin: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Por defecto hoy y 7 días adelante
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const enSieteDias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    const enSieteDiasStr = enSieteDias.toISOString().split('T')[0];

    this.searchForm.patchValue({
      fecha_inicio: hoyStr,
      fecha_fin: enSieteDiasStr,
    });

    this.searchService.listarEspecialidades().subscribe({
      next: (especialidades) => this.especialidades.set(especialidades),
      error: () => this.especialidades.set([]),
    });

    this.onBuscar();
  }

  onBuscar(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const val = this.searchForm.value;
    if (val.costo_min && val.costo_max && Number(val.costo_min) > Number(val.costo_max)) {
      this.errorMessage.set('El costo mínimo no puede superar al costo máximo');
      return;
    }

    if (val.fecha_inicio && val.fecha_fin && val.fecha_inicio > val.fecha_fin) {
      this.errorMessage.set('La fecha inicial no puede ser posterior a la fecha final');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const requestId = ++this.currentRequestId;

    this.searchService
      .buscarEspecialistas({
        nombre: val.nombre || undefined,
        especialidad_id: val.especialidad_id ? Number(val.especialidad_id) : undefined,
        modalidad: val.modalidad || 'AMBAS',
        costo_min: val.costo_min !== '' && val.costo_min !== null ? Number(val.costo_min) : undefined,
        costo_max: val.costo_max !== '' && val.costo_max !== null ? Number(val.costo_max) : undefined,
        fecha_inicio: val.fecha_inicio,
        fecha_fin: val.fecha_fin,
      })
      .subscribe({
        next: (resp) => {
          if (requestId === this.currentRequestId) {
            this.results.set(resp);
            this.loading.set(false);
          }
        },
        error: (err) => {
          if (requestId === this.currentRequestId) {
            this.errorMessage.set(
              err?.error?.detail || 'Ocurrió un error al consultar el catálogo de especialistas.',
            );
            this.loading.set(false);
          }
        },
      });
  }

  seleccionarEspecialista(esp: EspecialistaItem): void {
    this.selectedSpecialist.set(esp);
  }

  cerrarDetalle(): void {
    this.selectedSpecialist.set(null);
  }
}
