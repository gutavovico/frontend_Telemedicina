import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  TokenResponse,
  UsuarioResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest
} from '../models/auth.models';
import { InactivityService } from './inactivity.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly inactivity = inject(InactivityService);

  private readonly apiUrl = environment.apiUrl;
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Reactive state signals
  readonly isAuthenticated = signal<boolean>(this.hasValidToken());
  readonly currentUser = signal<UsuarioResponse | null>(this.getStoredUser());

  // Computed properties for UI
  readonly userDisplayName = computed(() => {
    const user = this.currentUser();
    if (!user) return 'Usuario';
    if (user.nombres) {
      const first = user.nombres.trim().split(' ')[0];
      const last = user.apellidos ? user.apellidos.trim().split(' ')[0] : '';
      return last ? `${first} ${last}` : first;
    }
    return user.correo.split('@')[0];
  });

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return 'US';
    
    if (user.nombres && user.apellidos) {
      const n = user.nombres.trim().charAt(0).toUpperCase();
      const a = user.apellidos.trim().charAt(0).toUpperCase();
      return `${n}${a}`;
    }

    if (user.nombres) {
      return user.nombres.trim().substring(0, 2).toUpperCase();
    }

    if (user.correo) {
      return user.correo.substring(0, 2).toUpperCase();
    }

    return 'US';
  });

  readonly userPhoto = computed(() => {
    return this.currentUser()?.foto_perfil || null;
  });

  constructor() {
    // If authenticated on initial load, fetch the fresh user profile
    if (this.isBrowser && this.hasValidToken()) {
      this.fetchUserProfile().subscribe();
      // Reanuda el control de inactividad con la preferencia guardada (CU23)
      this.inactivity.start(this.getRememberMe());
    }

    // Cierre de sesión automático por inactividad (CU23)
    this.inactivity.expired$.subscribe(() => this.onInactivityExpired());
  }

  private onInactivityExpired(): void {
    this.clearTokens();
    this.router.navigate(['/login'], { queryParams: { expired: 'true' } });
  }

  private hasValidToken(): boolean {
    if (!this.isBrowser) return false;
    return !!localStorage.getItem('access_token');
  }

  private getStoredUser(): UsuarioResponse | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem('user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  login(correo: string, password: string, rememberMe: boolean = false): Observable<TokenResponse> {
    const payload: LoginRequest = { correo, password };
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((response) => {
        this.saveTokens(response.access_token, response.refresh_token, rememberMe);
        
        // Initial fallback user from email until backend profile loads
        if (!this.currentUser()) {
          const fallbackUser: UsuarioResponse = {
            id_usuario: 0,
            nombres: correo.split('@')[0],
            apellidos: '',
            correo: correo,
            estado: 'ACTIVO'
          };
          this.saveUser(fallbackUser);
        }

        // Fetch full profile from backend
        this.fetchUserProfile().subscribe();
      })
    );
  }

  register(datos: RegisterRequest): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(`${this.apiUrl}/auth/register`, datos);
  }

  requestPasswordReset(correo: string): Observable<ForgotPasswordResponse> {
    const payload: ForgotPasswordRequest = { correo };
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/auth/forgot-password`, payload);
  }

  resetPassword(correo: string, codigo: string, nuevaPassword: string): Observable<{ detail: string }> {
    const payload: ResetPasswordRequest = { correo, codigo, nueva_password: nuevaPassword };
    return this.http.post<{ detail: string }>(`${this.apiUrl}/auth/reset-password`, payload);
  }

  fetchUserProfile(): Observable<UsuarioResponse | null> {
    if (!this.getAccessToken()) {
      return of(null);
    }

    // Try /auth/me first, fallback to /usuarios/me
    return this.http.get<UsuarioResponse>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => this.saveUser(user)),
      catchError(() => {
        return this.http.get<UsuarioResponse>(`${this.apiUrl}/usuarios/me`).pipe(
          tap((user) => this.saveUser(user)),
          catchError(() => of(null))
        );
      })
    );
  }

  refreshToken(): Observable<TokenResponse> {
    const refreshToken = this.getRefreshToken();
    const payload: RefreshTokenRequest = { refresh_token: refreshToken ?? '' };

    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/refresh`, payload).pipe(
      tap((response) => {
        this.saveTokens(response.access_token, response.refresh_token || refreshToken || '');
      })
    );
  }

  saveUser(user: UsuarioResponse): void {
    if (this.isBrowser) {
      localStorage.setItem('user_profile', JSON.stringify(user));
      this.currentUser.set(user);
    }
  }

  saveTokens(accessToken: string, refreshToken: string, rememberMe: boolean = false): void {
    if (this.isBrowser) {
      if (accessToken) {
        localStorage.setItem('access_token', accessToken);
      }
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      localStorage.setItem('remember_me', String(rememberMe));
      this.isAuthenticated.set(true);
      // Inicia el control de inactividad para cerrar sesión automáticamente (CU23)
      this.inactivity.start(rememberMe);
    }
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    this.inactivity.stop();

    const request$: Observable<unknown> = refreshToken
      ? this.http.post(`${this.apiUrl}/auth/logout`, { refresh_token: refreshToken })
      : of(null);

    request$.pipe(
      catchError(() => of(null)),
      finalize(() => {
        this.clearTokens();
        this.router.navigate(['/login']);
      })
    ).subscribe();
  }

  clearTokens(): void {
    if (this.isBrowser) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_profile');
      localStorage.removeItem('remember_me');
      this.currentUser.set(null);
      this.isAuthenticated.set(false);
      this.inactivity.stop();
    }
  }

  getRememberMe(): boolean {
    if (!this.isBrowser) return false;
    return localStorage.getItem('remember_me') === 'true';
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('refresh_token');
  }

  isLoggedIn(): boolean {
    return this.hasValidToken();
  }
}
