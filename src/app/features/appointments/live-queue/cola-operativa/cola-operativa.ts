import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { MedicoService } from '../../../../core/services/medico.service';
import type { MedicoResponse } from '../../../../core/models/medico.models';
import { LiveQueueService } from '../live-queue.service';
import { etiquetaEstadoCola } from '../../../../core/models/live-queue.models';

@Component({
  selector: 'app-cola-operativa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cola-operativa.html',
})
export class ColaOperativa implements OnInit, OnDestroy {
  readonly queue = inject(LiveQueueService);
  readonly authService = inject(AuthService);
  private readonly medicoService = inject(MedicoService);
  readonly etiquetaEstado = etiquetaEstadoCola;

  readonly medicos = signal<MedicoResponse[]>([]);
  medicoId: number | null = null;
  fecha = new Date().toISOString().slice(0, 10);

  pausaHoraInicio = '';
  pausaHoraFin = '';
  pausaMotivo = '';
  readonly mostrarPausa = signal(false);

  ngOnInit(): void {
    if (this.authService.isDoctor()) {
      this.cargar();
      this.queue.iniciarPollingCola(undefined, this.fecha);
    } else {
      this.medicoService.listarMedicos({ estado: 'activo', limit: 100 }).subscribe({
        next: (res) => this.medicos.set(res.items ?? []),
        error: () => this.medicos.set([]),
      });
    }
  }

  ngOnDestroy(): void {
    this.queue.detenerPolling();
  }

  nombreMedico(m: MedicoResponse): string {
    const nombre = `${m.usuario?.nombres ?? ''} ${m.usuario?.apellidos ?? ''}`.trim();
    return nombre || `Médico #${m.id_medico}`;
  }

  alCambiarMedico(): void {
    this.queue.detenerPolling();
    if (this.medicoId) {
      this.cargar();
      this.queue.iniciarPollingCola(this.medicoId, this.fecha);
    }
  }

  alCambiarFecha(): void {
    this.queue.detenerPolling();
    if (this.authService.isDoctor() || this.medicoId) {
      this.cargar();
      this.queue.iniciarPollingCola(this.medicoId ?? undefined, this.fecha);
    }
  }

  cargar(): void {
    this.queue.cargarCola(this.medicoId ?? undefined, this.fecha || undefined);
  }

  avanzar(idCita: number): void {
    this.queue.avanzar(idCita);
  }

  marcarPerdida(idCita: number): void {
    this.queue.marcarPerdida(idCita);
  }

  enviarPausa(): void {
    const idMedico = this.queue.cola()?.idMedico ?? this.medicoId;
    if (!idMedico || !this.pausaHoraInicio || !this.pausaHoraFin || this.pausaMotivo.trim().length < 3) {
      return;
    }
    this.queue.registrarPausa(
      {
        idMedico,
        fecha: this.queue.cola()?.fecha ?? this.fecha,
        horaInicio: this.pausaHoraInicio,
        horaFin: this.pausaHoraFin,
        motivo: this.pausaMotivo.trim(),
      },
      () => {
        this.pausaHoraInicio = '';
        this.pausaHoraFin = '';
        this.pausaMotivo = '';
        this.mostrarPausa.set(false);
        this.cargar();
      },
    );
  }
}
