import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { normalizeAppRole } from '../../../core/models/auth.models';
import { TenantSelectorComponent } from '../../../shared/components/tenant-selector/tenant-selector';

@Component({
  selector: 'app-admin-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TenantSelectorComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {
  readonly authService = inject(AuthService);
  readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);

  readonly isSidebarOpen = signal(false);
  readonly isDropdownOpen = signal(false);

  canSeeReports(): boolean {
    const user = this.authService.currentUser();
    return this.authService.isAuthenticated()
      && this.authService.profileVerified()
      && normalizeAppRole(user?.rol) === 'admin'
      && user?.estado.toUpperCase() === 'ACTIVO'
      && typeof user.id_clinica === 'number'
      && user.id_clinica > 0;
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
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
    this.router.navigate(['/mi-perfil-medico']);
  }

  logout(): void {
    this.closeDropdown();
    this.authService.logout();
  }
}
