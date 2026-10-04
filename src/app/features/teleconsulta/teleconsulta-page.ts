import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TeleconsultaService } from './services/teleconsulta.service';

@Component({
  selector: 'app-teleconsulta-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './teleconsulta-page.html',
  styleUrl: './teleconsulta-page.css'
})
export class TeleconsultaPage implements OnInit, OnDestroy {
  protected readonly teleconsultaService = inject(TeleconsultaService);
  private readonly route = inject(ActivatedRoute);

  // Signal para el input de texto del chat
  nuevoMensajeTexto = signal<string>('');

  @ViewChild('chatMessagesContainer') chatContainer?: ElementRef<HTMLDivElement>;

  constructor() {
    // Scroll automático al recibir o enviar nuevos mensajes
    effect(() => {
      const _ = this.teleconsultaService.mensajes();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  ngOnInit(): void {
    const idCitaParam = this.route.snapshot.paramMap.get('id');
    let idCita: number | undefined;

    if (idCitaParam) {
      const parsed = Number(idCitaParam);
      if (!isNaN(parsed) && parsed > 0) {
        idCita = parsed;
      }
    }

    // Cargar datos de la teleconsulta
    this.teleconsultaService.cargarTeleconsulta(idCita);

    // Iniciar sincronización periódica en segundo plano
    this.teleconsultaService.iniciarPolling(idCita, 4000);
  }

  ngOnDestroy(): void {
    this.teleconsultaService.detenerPolling();
  }

  enviarMensaje(): void {
    const texto = this.nuevoMensajeTexto();
    if (texto.trim()) {
      this.teleconsultaService.enviarMensaje(texto);
      this.nuevoMensajeTexto.set('');
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  private scrollToBottom(): void {
    if (this.chatContainer?.nativeElement) {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    }
  }
}
