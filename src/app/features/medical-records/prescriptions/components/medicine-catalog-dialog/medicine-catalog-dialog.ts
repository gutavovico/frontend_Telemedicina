import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../../core/services/auth.service';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { Medicamento } from '../../models/prescription.models';

@Component({
  selector: 'app-medicine-catalog-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './medicine-catalog-dialog.html',
  styleUrl: './medicine-catalog-dialog.css',
})
export class MedicineCatalogDialog implements OnChanges {
  @Input() open = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly medicineCreated = new EventEmitter<Medicamento>();

  @ViewChild('dialogPanel') dialogPanel?: ElementRef<HTMLElement>;
  @ViewChild('firstField') firstField?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PrescriptionsService);
  readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly results = signal<Medicamento[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly searchError = signal<string | null>(null);

  readonly createForm = this.fb.group({
    nombre: this.fb.control<string>('', {
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)],
    }),
    principio_activo: this.fb.control<string | null>(null),
    concentracion: this.fb.control<string | null>(null),
    forma_farmaceutica: this.fb.control<string | null>(null),
    descripcion: this.fb.control<string | null>(null),
  });

  readonly isCreating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly createSuccess = signal<string | null>(null);

  private previousFocus: HTMLElement | null = null;

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((term) => term.trim().length >= 2),
        switchMap((term) => {
          this.isSearching.set(true);
          this.searchError.set(null);
          return this.service.searchMedicines({ query: term.trim(), limit: 10 });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.results.set(res.items);
          this.isSearching.set(false);
        },
        error: () => {
          this.isSearching.set(false);
          this.searchError.set('No se pudo buscar en el catálogo.');
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        this.createError.set(null);
        this.createSuccess.set(null);
        setTimeout(() => this.firstField?.nativeElement.focus(), 0);
      } else if (this.previousFocus) {
        this.previousFocus.focus();
        this.previousFocus = null;
      }
    }
  }

  get canSearch(): boolean {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'doctor';
  }

  // Alta de medicamento (CU16, hallazgo 2): solo ADMIN real. El contrato actual
  // no expone permisos efectivos al frontend, por lo que la interfaz exige rol
  // administrador y el backend valida como autoridad final
  // `prescriptions:catalog:write` (403 se informa en el diálogo).
  get canCreate(): boolean {
    return this.authService.isAdmin();
  }

  cerrar(): void {
    this.closed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrar();
      return;
    }
    if (event.key !== 'Tab' || !this.dialogPanel?.nativeElement) {
      return;
    }
    const panel = this.dialogPanel.nativeElement;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  crear(): void {
    if (!this.canCreate || this.isCreating()) {
      return;
    }
    this.createError.set(null);
    this.createSuccess.set(null);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const crudo = this.createForm.getRawValue();
    const nombre = (crudo.nombre ?? '').trim();
    if (nombre === '') {
      return;
    }
    const payload = {
      nombre,
      principio_activo: this.norm(crudo.principio_activo),
      concentracion: this.norm(crudo.concentracion),
      forma_farmaceutica: this.norm(crudo.forma_farmaceutica),
      descripcion: this.norm(crudo.descripcion),
    };
    this.isCreating.set(true);
    this.service.createMedicine(payload).subscribe({
      next: (med) => {
        this.isCreating.set(false);
        this.createSuccess.set(`Medicamento "${med.nombre}" creado.`);
        this.createForm.reset();
        this.medicineCreated.emit(med);
      },
      error: (err: unknown) => {
        this.isCreating.set(false);
        if (err instanceof HttpErrorResponse) {
          const detail =
            typeof err.error === 'object' && err.error !== null && 'detail' in err.error
              ? String((err.error as { detail: unknown }).detail)
              : 'No se pudo crear el medicamento.';
          if (err.status === 409) {
            this.createError.set(`Duplicado: ${detail}`);
          } else if (err.status === 403) {
            this.createError.set(`Sin permiso: ${detail}`);
          } else {
            this.createError.set(detail);
          }
        } else {
          this.createError.set('Error de conexión. Intente nuevamente.');
        }
      },
    });
  }

  private norm(valor: string | null): string | null {
    if (valor === null || valor === undefined) {
      return null;
    }
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }
}
