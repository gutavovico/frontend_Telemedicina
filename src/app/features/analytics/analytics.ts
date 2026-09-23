import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../shared/components/header/header';
import { Footer } from '../../shared/components/footer/footer';

/**
 * Placeholder canónico para el módulo de Analítica y Reportes Clínicos (Sprint 3).
 */
@Component({
  selector: 'app-analytics',
  imports: [CommonModule, Header, Footer],
  template: `
    <div class="min-h-screen flex flex-col justify-between bg-surface">
      <app-header />
      <main class="flex-grow flex items-center justify-center p-6">
        <div class="glass-card max-w-lg w-full p-8 rounded-3xl shadow-level-2 text-center border border-outline-variant/30">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-3xl">bar_chart</span>
          </div>
          <h1 class="text-2xl font-bold text-primary font-headline-lg mb-2">Analítica y Métricas Clínicas</h1>
          <p class="text-sm text-on-surface-variant font-body-md mb-6">
            Módulo canónico en preparación para el Sprint 3: Indicadores de ocupación hospitalaria, métricas de atención por especialidad y auditoría de accesos multitenant.
          </p>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed/60 text-primary text-xs font-semibold">
            <span class="material-symbols-outlined text-sm">schedule</span>
            <span>Sprint 3 Baseline</span>
          </div>
        </div>
      </main>
      <app-footer />
    </div>
  `
})
export class Analytics {}
