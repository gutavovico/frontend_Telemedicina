import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../shared/components/header/header';
import { Footer } from '../../shared/components/footer/footer';

/**
 * Placeholder canónico para el Asistente de IA y Triaje Clínico Inteligente (Sprint 4).
 */
@Component({
  selector: 'app-ai-assistant',
  imports: [CommonModule, Header, Footer],
  template: `
    <div class="min-h-screen flex flex-col justify-between bg-surface">
      <app-header />
      <main class="flex-grow flex items-center justify-center p-6">
        <div class="glass-card max-w-lg w-full p-8 rounded-3xl shadow-level-2 text-center border border-outline-variant/30">
          <div class="w-16 h-16 rounded-2xl bg-teal-accent/10 text-secondary mx-auto flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-3xl">psychology</span>
          </div>
          <h1 class="text-2xl font-bold text-primary font-headline-lg mb-2">Asistente Clínico Inteligente (IA)</h1>
          <p class="text-sm text-on-surface-variant font-body-md mb-6">
            Módulo canónico en preparación para el Sprint 4: Triaje predictivo de síntomas pre-consulta, sugerencias diagnósticas basadas en guías clínicas y resumen automático de expedientes.
          </p>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/40 text-secondary text-xs font-semibold">
            <span class="material-symbols-outlined text-sm">schedule</span>
            <span>Sprint 4 Baseline</span>
          </div>
        </div>
      </main>
      <app-footer />
    </div>
  `
})
export class AiAssistant {}
