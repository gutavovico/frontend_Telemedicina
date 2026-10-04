import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { LiveQueueService } from '../live-queue.service';
import { etiquetaEstadoCola } from '../../../../core/models/live-queue.models';

@Component({
  selector: 'app-mi-cola',
  standalone: true,
  imports: [CommonModule, RouterLink, Header],
  templateUrl: './mi-cola.html',
})
export class MiCola implements OnInit, OnDestroy {
  readonly queue = inject(LiveQueueService);
  readonly etiquetaEstado = etiquetaEstadoCola;

  ngOnInit(): void {
    this.queue.cargarMiTurno();
    this.queue.iniciarPollingMiTurno(5000);
  }

  ngOnDestroy(): void {
    this.queue.detenerPolling();
  }

  reintentar(): void {
    this.queue.cargarMiTurno();
  }
}
