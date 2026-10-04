import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Componente / Acción de Cierre de Sesión Seguro (CU24).
 * Revoca el token en el backend y limpia el contexto local.
 */
@Component({
  selector: 'app-logout',
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-surface">
      <div class="glass-card p-8 rounded-2xl shadow-level-2 text-center max-w-sm w-full mx-4">
        <div class="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
        </div>
        <h2 class="text-lg font-bold text-primary font-headline-lg mb-1">Cerrando sesión...</h2>
        <p class="text-xs text-on-surface-variant font-body-md">Revocando credenciales y asegurando tu cuenta.</p>
      </div>
    </div>
  `
})
export class Logout implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
