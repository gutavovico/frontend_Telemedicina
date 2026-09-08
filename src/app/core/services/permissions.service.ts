import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Permission,
  RolePermissionAssignment,
  RolePermissionsUpdate
} from '../models/role.models';
import { TenantService } from './tenant.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);
  private readonly apiUrl = environment.apiUrl;

  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`);
  }

  getRolePermissions(idRol: number): Observable<Array<RolePermissionAssignment | Permission | number>> {
    return this.http.get<Array<RolePermissionAssignment | Permission | number>>(
      `${this.apiUrl}/roles/${idRol}/permissions`
    );
  }

  updateRolePermissions(idRol: number, payload: RolePermissionsUpdate): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/roles/${idRol}/permissions`, payload);
  }

  hasPermission(permission: string): boolean {
    if (this.isSuperAdmin()) return true;
    const userPermissions = this.tenantService.permisos();
    return userPermissions.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    if (this.isSuperAdmin()) return true;
    const userPermissions = this.tenantService.permisos();
    return permissions.some((p) => userPermissions.includes(p));
  }

  hasAllPermissions(permissions: string[]): boolean {
    if (this.isSuperAdmin()) return true;
    const userPermissions = this.tenantService.permisos();
    return permissions.every((p) => userPermissions.includes(p));
  }

  isSuperAdmin(): boolean {
    return this.tenantService.isSuperAdmin();
  }

  isAdminClinica(): boolean {
    const rol = this.tenantService.currentTenant()?.rol?.toUpperCase();
    return rol === 'ADMIN' || rol === 'ADMINISTRADOR' || rol === 'ADMINISTRACION';
  }
}

