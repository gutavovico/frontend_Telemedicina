import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-clinica-inactiva',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error-page-container">
      <div class="error-card">
        <div class="error-icon">🏥⚠️</div>
        <h2>Clínica Inactiva o Suspendida</h2>
        <p class="description">
          El acceso para esta clínica se encuentra temporalmente deshabilitado o suspendido.
          Por favor, comuníquese con el administrador de la plataforma para regularizar el estado de su suscripción o servicio.
        </p>
        <div class="actions">
          <button (click)="logout()" class="btn-logout">Cerrar Sesión</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .error-page-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: #f8fafc;
      font-family: inherit;
    }
    .error-card {
      background: #ffffff;
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
      max-width: 500px;
      text-align: center;
    }
    .error-icon {
      font-size: 3.5rem;
      margin-bottom: 1rem;
    }
    h2 {
      color: #b45309;
      margin-bottom: 1rem;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .description {
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    .btn-logout {
      background-color: #0284c7;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-logout:hover {
      opacity: 0.9;
    }
  `]
})
export class ClinicaInactiva {
  private readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
