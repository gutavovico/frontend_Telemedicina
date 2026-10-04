import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, RoleCreate, RoleStatusUpdate, RoleUpdate } from '../models/role.models';

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  getRoleById(idRol: number): Observable<Role> {
    return this.http.get<Role>(`${this.apiUrl}/roles/${idRol}`);
  }

  createRole(payload: RoleCreate): Observable<Role> {
    return this.http.post<Role>(`${this.apiUrl}/roles`, payload);
  }

  updateRole(idRol: number, payload: RoleUpdate): Observable<Role> {
    return this.http.put<Role>(`${this.apiUrl}/roles/${idRol}`, payload);
  }

  updateRoleStatus(idRol: number, payload: RoleStatusUpdate): Observable<Role> {
    return this.http.patch<Role>(`${this.apiUrl}/roles/${idRol}/status`, payload);
  }
}
