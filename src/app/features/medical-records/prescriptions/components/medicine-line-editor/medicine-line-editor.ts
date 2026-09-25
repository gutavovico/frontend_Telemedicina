import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PrescriptionsService } from '../../services/prescriptions.service';
import {
  Medicamento,
  ViaAdministracion,
  VIAS_ADMINISTRACION,
} from '../../models/prescription.models';

export interface MedicineLineControls {
  modo: FormControl<'catalogo' | 'manual' | null>;
  id_medicamento: FormControl<number | null>;
  nombre_medicamento_manual: FormControl<string | null>;
  dosis: FormControl<string | null>;
  frecuencia: FormControl<string | null>;
  duracion: FormControl<string | null>;
  via_administracion: FormControl<ViaAdministracion | null>;
  cantidad: FormControl<number | null>;
  indicaciones: FormControl<string | null>;
}

export type MedicineLineFormGroup = FormGroup<MedicineLineControls>;

@Component({
  selector: 'app-medicine-line-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './medicine-line-editor.html',
  styleUrl: './medicine-line-editor.css',
})
export class MedicineLineEditor implements OnInit {
  @Input({ required: true }) line!: MedicineLineFormGroup;
  @Input() index = 0;
  @Input() canRemove = true;

  @Output() readonly removeRequested = new EventEmitter<void>();

  private readonly service = inject(PrescriptionsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly searchResults = signal<Medicamento[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly searchError = signal<string | null>(null);

  readonly vias: ViaAdministracion[] = VIAS_ADMINISTRACION;

  ngOnInit(): void {
    const actual = this.line.controls.id_medicamento.value;
    if (actual !== null && actual !== undefined) {
      this.line.controls.modo.setValue('catalogo', { emitEvent: false });
    } else if ((this.line.controls.nombre_medicamento_manual.value ?? '').trim() !== '') {
      this.line.controls.modo.setValue('manual', { emitEvent: false });
    }

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((term) => term.trim().length >= 2),
        switchMap((term) => {
          this.isSearching.set(true);
          this.searchError.set(null);
          return this.service.searchMedicines({ query: term.trim(), estado: 'ACTIVO', limit: 10 });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.searchResults.set(res.items);
          this.isSearching.set(false);
        },
        error: () => {
          this.isSearching.set(false);
          this.searchError.set('No se pudo buscar en el catálogo.');
        },
      });
  }

  get modo(): 'catalogo' | 'manual' {
    return this.line.controls.modo.value ?? 'catalogo';
  }

  usarCatalogo(): void {
    this.line.controls.modo.setValue('catalogo');
    this.line.controls.nombre_medicamento_manual.setValue(null);
    this.line.controls.nombre_medicamento_manual.markAsUntouched();
  }

  usarManual(): void {
    this.line.controls.modo.setValue('manual');
    this.line.controls.id_medicamento.setValue(null);
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
  }

  elegirMedicamento(med: Medicamento): void {
    this.line.controls.id_medicamento.setValue(med.id_medicamento);
    this.line.controls.nombre_medicamento_manual.setValue(null);
    this.searchControl.setValue(med.nombre, { emitEvent: false });
    this.searchResults.set([]);
    this.line.controls.id_medicamento.markAsTouched();
  }

  limpiarSeleccion(): void {
    this.line.controls.id_medicamento.setValue(null);
    this.searchControl.setValue('');
    this.searchResults.set([]);
  }

  solicitarRetiro(): void {
    this.removeRequested.emit();
  }

  campoId(sufijo: string): string {
    return `linea-${this.index}-${sufijo}`;
  }
}
