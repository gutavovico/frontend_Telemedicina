import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { normalizeAppRole } from '../../../core/models/auth.models';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  readonly authService = inject(AuthService);
  readonly tenantService = inject(TenantService);
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

  // Dentro del panel /admin manda el topbar del AdminLayout: el header
  // global se oculta para no duplicar navegación.
  isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }

  // Landing (/) con header minimalista: sin links de gestión (viven en /admin).
  // Evita el amontonamiento de 11 enlaces visto en la captura.
  isLandingRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0].trim();
    return url === '/' || url === '';
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

  isReportsRoute(): boolean {
    return this.router.url.startsWith('/analitica');
  }

  canSeeReports(): boolean {
    const user = this.authService.currentUser();
    return this.authService.isAuthenticated()
      && this.authService.profileVerified()
      && normalizeAppRole(user?.rol) === 'admin'
      && user?.estado.toUpperCase() === 'ACTIVO'
      && typeof user.id_clinica === 'number'
      && user.id_clinica > 0;
  }

  canSeeAgenda(): boolean {
    if (!this.authService.isAuthenticated()) return false;
    const role = (this.authService.currentUser()?.rol ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRACION', 'MEDICO', 'RECEPCION'].includes(role);
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

  // Links de gestión (CU03/CU05/CU09/CU12/CU25): ADMIN, MEDICO y RECEPCION.
  // Usuarios/Roles/Médicos quedan fuera: son solo ADMIN (CU02/CU26/CU04).
  canSeeGestion(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    const role = this.authService.userRole();
    return role === 'admin' || role === 'doctor' || role === 'recepcion';
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
    // Recepción no tiene vista de perfil: va a su panel (agenda)
    if (this.authService.isRecepcion()) {
      this.router.navigate(['/admin/agenda']);
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

  canSeeAdminPanel(): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }
    return this.tenantService.isSuperAdmin() || this.authService.isAdmin();
  }

  goToAdminPanel(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    if (this.tenantService.isSuperAdmin()) {
      this.router.navigate(['/admin/clinicas']);
    } else {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  goToRecepcionPanel(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(['/admin/agenda']);
  }

  goToMedicoPanel(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(['/admin/agenda']);
  }

  logout(): void {
    this.closeDropdown();
    this.closeMobileMenu();
    this.authService.logoutRemoto();
  }
}
