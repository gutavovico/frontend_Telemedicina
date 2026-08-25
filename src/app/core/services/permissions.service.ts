import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Permission,
  RolePermissionAssignment,
  RolePermissionsUpdate
} from '../models/role.models';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly http = inject(HttpClient);
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
}
