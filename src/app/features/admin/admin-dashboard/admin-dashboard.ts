import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ClinicasService } from '../../../core/services/clinicas.service';
import { UsersService } from '../../../core/services/users.service';
import { RolesService } from '../../../core/services/roles.service';
import { MedicoService } from '../../../core/services/medico.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
  readonly authService = inject(AuthService);
  readonly tenantService = inject(TenantService);
  private readonly clinicasService = inject(ClinicasService);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly medicoService = inject(MedicoService);

  readonly isLoading = signal(true);
  readonly clinicasTotal = signal<number | null>(null);
  readonly clinicasActivas = signal<number | null>(null);
  readonly usersCount = signal<number | null>(null);
  readonly rolesCount = signal<number | null>(null);
  readonly medicosCount = signal<number | null>(null);

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  cargarEstadisticas(): void {
    this.isLoading.set(true);

    if (this.tenantService.isSuperAdmin()) {
      this.clinicasService.listClinicas(undefined, 1, 100).pipe(
        catchError(() => of({ total: 0, items: [], page: 1, per_page: 100 }))
      ).subscribe(res => {
        this.clinicasTotal.set(res.total);
        const activas = res.items.filter(c => c.estado === 'ACTIVO').length;
        this.clinicasActivas.set(activas);
      });
    }

    // Usuarios count
    this.usersService.getUsers().pipe(
      catchError(() => of([]))
    ).subscribe(users => {
      this.usersCount.set(users.length);
    });

    // Roles count
    this.rolesService.getRoles().pipe(
      catchError(() => of([]))
    ).subscribe(roles => {
      this.rolesCount.set(roles.length);
    });

    // Médicos count
    this.medicoService.listarMedicos({ limit: 100 }).pipe(
      catchError(() => of({ total: 0, items: [] }))
    ).subscribe(res => {
      this.medicosCount.set(res.total ?? (res.items?.length || 0));
      this.isLoading.set(false);
    });
  }
}
