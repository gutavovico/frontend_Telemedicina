import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { PrescriptionsService } from '../../services/prescriptions.service';
import {
  RecetaValidacionPublicaEncontrada,
  RecetaValidacionPublicaResponse,
  esRespuestaNoEncontrada,
} from '../../models/prescription.models';

type EstadoVista =
  | 'inicial'
  | 'cargando'
  | 'emitida'
  | 'vencida'
  | 'anulada'
  | 'no-encontrada'
  | 'limitada'
  | 'error';

@Component({
  selector: 'app-prescription-public-validation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './prescription-public-validation.html',
  styleUrl: './prescription-public-validation.css',
})
export class PrescriptionPublicValidation implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PrescriptionsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly codigoInput = signal<string>('');
  readonly resultado = signal<RecetaValidacionPublicaResponse | null>(null);
  readonly estadoVista = signal<EstadoVista>('inicial');
  readonly mensajeError = signal<string | null>(null);
  readonly reintentoEn = signal<number>(0);

  readonly detalleEncontrado = computed<RecetaValidacionPublicaEncontrada | null>(() => {
    const res = this.resultado();
    if (!res || esRespuestaNoEncontrada(res)) {
      return null;
    }
    return res;
  });

  private temporizador: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (codigo && codigo.trim() !== '') {
      this.codigoInput.set(codigo.trim());
      this.validar();
    }
  }

  ngOnDestroy(): void {
    this.limpiarTemporizador();
  }

  validar(): void {
    const codigo = this.codigoInput().trim();
    if (codigo === '' || this.estadoVista() === 'cargando' || this.reintentoEn() > 0) {
      return;
    }
    this.estadoVista.set('cargando');
    this.mensajeError.set(null);
    this.resultado.set(null);
    this.service.validatePublic(codigo).subscribe({
      next: (res) => {
        this.resultado.set(res);
        if (esRespuestaNoEncontrada(res)) {
          this.estadoVista.set('no-encontrada');
        } else if (res.estado === 'ANULADA') {
          this.estadoVista.set('anulada');
        } else if (res.estado === 'VENCIDA') {
          this.estadoVista.set('vencida');
        } else {
          this.estadoVista.set('emitida');
        }
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 429) {
          const retryAfter = Number(err.headers.get('Retry-After') ?? '60');
          const segundos = Number.isNaN(retryAfter) ? 60 : Math.max(1, retryAfter);
          this.estadoVista.set('limitada');
          this.iniciarCuentaRegresiva(segundos);
        } else if (err instanceof HttpErrorResponse && err.status === 404) {
          this.estadoVista.set('no-encontrada');
          this.resultado.set({ valida: false, estado: 'NO_ENCONTRADA' });
        } else {
          this.estadoVista.set('error');
          this.mensajeError.set('No se pudo validar el código. Intente nuevamente.');
        }
      },
    });
  }

  limpiar(): void {
    this.codigoInput.set('');
    this.resultado.set(null);
    this.estadoVista.set('inicial');
    this.mensajeError.set(null);
    this.limpiarTemporizador();
    this.reintentoEn.set(0);
  }

  badgeClass(): string {
    switch (this.estadoVista()) {
      case 'emitida':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'vencida':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'anulada':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'no-encontrada':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'limitada':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  estadoTexto(): string {
    switch (this.estadoVista()) {
      case 'emitida':
        return 'Vigente';
      case 'vencida':
        return 'Vencida';
      case 'anulada':
        return 'Anulada';
      case 'no-encontrada':
        return 'No encontrada';
      case 'limitada':
        return 'Límite temporal';
      case 'cargando':
        return 'Validando...';
      case 'error':
        return 'Error';
      default:
        return 'Sin validar';
    }
  }

  private iniciarCuentaRegresiva(segundos: number): void {
    this.limpiarTemporizador();
    this.reintentoEn.set(segundos);
    if (!this.isBrowser) {
      return;
    }
    this.temporizador = setInterval(() => {
      const actual = this.reintentoEn();
      if (actual <= 1) {
        this.limpiarTemporizador();
        this.reintentoEn.set(0);
        this.estadoVista.set('inicial');
      } else {
        this.reintentoEn.set(actual - 1);
      }
    }, 1000);
  }

  private limpiarTemporizador(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
