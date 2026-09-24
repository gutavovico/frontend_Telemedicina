import {
  Component,
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
import { HttpErrorResponse } from '@angular/common/http';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { RecetaResponse } from '../../models/prescription.models';

@Component({
  selector: 'app-cancel-prescription-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cancel-prescription-dialog.html',
  styleUrl: './cancel-prescription-dialog.css',
})
export class CancelPrescriptionDialog implements OnChanges {
  @Input() open = false;
  @Input() recetaId: number | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<RecetaResponse>();

  @ViewChild('dialogPanel') dialogPanel?: ElementRef<HTMLElement>;
  @ViewChild('motivoField') motivoField?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PrescriptionsService);

  readonly form = this.fb.group({
    motivo_anulacion: this.fb.control<string>('', {
      validators: [Validators.required, Validators.minLength(15), Validators.maxLength(500)],
    }),
    observaciones_anulacion: this.fb.control<string | null>(null),
    id_receta_sustituta: this.fb.control<number | null>(null),
  });

  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly errorCode = signal<string | null>(null);

  private previousFocus: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        this.errorMessage.set(null);
        this.errorCode.set(null);
        setTimeout(() => this.motivoField?.nativeElement.focus(), 0);
      } else if (this.previousFocus) {
        this.previousFocus.focus();
        this.previousFocus = null;
      }
    }
  }

  cerrar(): void {
    if (this.isSubmitting()) {
      return;
    }
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

  confirmar(): void {
    if (this.isSubmitting() || this.recetaId === null) {
      return;
    }
    this.errorMessage.set(null);
    this.errorCode.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const crudo = this.form.getRawValue();
    const motivo = (crudo.motivo_anulacion ?? '').trim();
    const observaciones =
      crudo.observaciones_anulacion && crudo.observaciones_anulacion.trim() !== ''
        ? crudo.observaciones_anulacion.trim()
        : null;
    const payload = {
      motivo_anulacion: motivo,
      observaciones_anulacion: observaciones,
      id_receta_sustituta: crudo.id_receta_sustituta ?? null,
    };
    this.isSubmitting.set(true);
    this.service.cancelPrescription(this.recetaId, payload).subscribe({
      next: (receta) => {
        this.isSubmitting.set(false);
        this.cancelled.emit(receta);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        if (err instanceof HttpErrorResponse) {
          const body = err.error as unknown;
          let detail = 'No se pudo anular la receta.';
          let code: string | null = null;
          if (typeof body === 'object' && body !== null) {
            const registro = body as Record<string, unknown>;
            if (typeof registro['detail'] === 'string') {
              detail = registro['detail'];
            }
            if (typeof registro['code'] === 'string') {
              code = registro['code'];
            }
          }
          this.errorMessage.set(detail);
          this.errorCode.set(code);
          if (err.status === 404 || err.status === 403) {
            // Conserva la entrada no sensible; el usuario decide cerrar.
          }
        } else {
          this.errorMessage.set('Error de conexión. Intente nuevamente.');
        }
      },
    });
  }
}
