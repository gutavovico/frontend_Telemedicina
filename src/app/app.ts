import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Header } from './shared/components/header/header';
import { InactivityWarning } from './features/auth/inactivity-warning/inactivity-warning';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, InactivityWarning],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);

  // El header global se oculta en /admin (ver Header.isAdminRoute):
  // sin esto el <main> dejaba 80px (pt-20) de aire huérfano arriba del topbar del panel.
  isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }
}
