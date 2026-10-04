import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminUser,
  AdminUserCreate,
  AdminUserStatusUpdate,
  AdminUserUpdate,
  UserRole
} from '../models/user.models';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.apiUrl}/users`);
  }

  getUserById(idUsuario: number): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.apiUrl}/users/${idUsuario}`);
  }

  createUser(payload: AdminUserCreate): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${this.apiUrl}/users`, payload);
  }

  updateUser(idUsuario: number, payload: AdminUserUpdate): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.apiUrl}/users/${idUsuario}`, payload);
  }

  updateUserStatus(idUsuario: number, payload: AdminUserStatusUpdate): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/users/${idUsuario}/status`, payload);
  }

  getRoles(): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(`${this.apiUrl}/roles`);
  }
}
