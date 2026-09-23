import { Component, input } from '@angular/core';
import { BloqueoAgenda, DisponibilidadAgenda, SlotAgenda } from '../medical-agenda.models';
import { etiquetaSlot } from '../medical-agenda.utils';

@Component({
  selector: 'app-agenda-availability', standalone: true,
  styleUrl: '../medical-agenda.css',
  template: `
    @if (agenda(); as data) {
      @for (warning of data.advertencias; track $index) { <p class="agenda-notice" role="status">{{ warning }}</p> }
      <p class="agenda-muted">Los períodos no disponibles pueden corresponder a citas o a horarios desactivados. Solo se identifican los bloqueos confirmados en el listado.</p>
      <div class="agenda-slots">
        @for (slot of data.slots; track slot.hora_inicio) {
          <div class="agenda-slot" [class.available]="data.citas_verificadas && slot.disponible"
               [class.blocked]="label(slot).startsWith('Bloque')">
            <strong>{{ slot.hora_inicio.slice(0, 5) }} – {{ slot.hora_fin.slice(0, 5) }}</strong>
            <span>{{ label(slot) }}</span>
          </div>
        } @empty { <p class="agenda-muted">No hay períodos para esta selección.</p> }
      </div>
    } @else { <p class="agenda-muted">Selecciona médico, servicio y fecha para consultar disponibilidad.</p> }
  `
})
export class AgendaAvailabilityView {
  readonly agenda = input<DisponibilidadAgenda | null>(null);
  readonly bloqueos = input<BloqueoAgenda[]>([]);
  label(slot: SlotAgenda): string {
    const agenda = this.agenda();
    return agenda ? etiquetaSlot(slot, agenda, this.bloqueos()) : 'Sin verificar';
  }
}
