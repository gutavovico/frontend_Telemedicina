import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isMobileMenuOpen = signal(false);
  readonly isDropdownOpen = signal(false);

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(value => !value);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  isUsersRoute(): boolean {
    return this.router.url.startsWith('/usuarios');
  }

  isRolesRoute(): boolean {
    return this.router.url.startsWith('/roles');
  }

  showAdminNavigation(): boolean {
    return this.authService.isAuthenticated() || this.isUsersRoute() || this.isRolesRoute();
  }

  openDropdown(): void {
    this.isDropdownOpen.set(true);
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update(v => !v);
  }

  goToProfile(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    // Perfil profesional del médico autenticado (CU04)
    this.router.navigate(['/mi-perfil-medico']);
  }

  goToMedicos(): void {
    this.closeMobileMenu();
    // CU04: el doctor solo gestiona su propio perfil; admin ve el listado completo
    if (this.authService.isDoctor()) {
      this.router.navigate(['/mi-perfil-medico']);
      return;
    }
    this.router.navigate(['/medicos']);
  }

  logout(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.authService.logout();
  }
}
