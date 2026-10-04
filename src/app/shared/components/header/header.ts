import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isMobileMenuOpen = signal(false);
  readonly isDropdownOpen = signal(false);

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((value) => !value);
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

  isRecetasRoute(): boolean {
    return this.router.url.startsWith('/recetas');
  }

  isProductsRoute(): boolean {
    return this.router.url.startsWith('/medicamentos');
  }

  isTeleconsultaRoute(): boolean {
    return this.router.url.startsWith('/teleconsulta') || this.router.url.includes('/teleconsulta');
  }

  isMisCitasRoute(): boolean {
    return this.router.url.startsWith('/mis-citas') || (this.authService.isPaciente() && this.router.url.startsWith('/citas'));
  }

  // Entrada "Teleconsulta" (CU15): Solo visible para ADMIN. 
  // Oculto para MÉDICO (se gestiona desde Gestión de Consultas) y PACIENTE (reemplazado por Citas).
  canSeeTeleconsulta(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    const role = this.authService.userRole();
    return role === 'admin';
  }

  // Entrada "Citas" para PACIENTE: Navega a la vista de "Mis citas"
  canSeeCitasPaciente(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    return this.authService.isPaciente();
  }

  // Entrada "Recetas" (CU16, hallazgo 4): visible para ADMIN, MEDICO y PACIENTE
  // reales; oculta para roles desconocidos y visitantes.
  canSeeRecetas(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    const role = this.authService.userRole();
    return role === 'admin' || role === 'doctor' || role === 'paciente';
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
    this.isDropdownOpen.update((v) => !v);
  }

  goToProfile(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    // Si el usuario autenticado tiene rol de paciente, redirige a su vista de Mis citas
    if (this.authService.isPaciente()) {
      this.router.navigate(['/mis-citas']);
      return;
    }
    // Perfil profesional del médico autenticado (CU04)
    this.router.navigate(['/mi-perfil-medico']);
  }

  goToMedicos(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(['/medicos']);
  }

  goToRecetas(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(['/recetas']);
  }

  goToProducts(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(['/medicamentos']);
  }

  logout(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.authService.logout();
  }
}
