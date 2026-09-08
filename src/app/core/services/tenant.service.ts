import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { catchError, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantContext } from '../models/tenant.models';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly apiUrl = environment.apiUrl;

  private readonly TENANT_CONTEXT_KEY = 'current_tenant_context';
  private readonly SELECTED_TENANT_ID_KEY = 'selected_tenant_id';

  // Signals
  readonly currentTenant = signal<TenantContext | null>(this.getStoredTenantContext());
  readonly selectedTenantId = signal<number | null>(this.getStoredSelectedTenantId());

  // Computed signals
  readonly clinicaId = computed(() => this.currentTenant()?.clinica_id ?? null);
  readonly clinicaNombre = computed(() => this.currentTenant()?.clinica_nombre || 'Telemedicina');
  readonly clinicaEstado = computed(() => this.currentTenant()?.clinica_estado ?? null);
  readonly isSuperAdmin = computed(() => this.currentTenant()?.es_super_admin ?? false);
  readonly isClinicaActiva = computed(() => {
    const estado = this.currentTenant()?.clinica_estado;
    if (this.isSuperAdmin() && !this.clinicaId()) return true; // Super admin global view is active
    return estado === 'ACTIVO';
  });
  readonly permisos = computed(() => this.currentTenant()?.permisos ?? []);

  constructor() {
    if (this.isBrowser && localStorage.getItem('access_token')) {
      this.loadTenantContext().subscribe();
    }
  }

  loadTenantContext(): Observable<TenantContext | null> {
    return this.http.get<TenantContext>(`${this.apiUrl}/api/v1/tenant/context`).pipe(
      tap((context) => {
        this.saveTenantContext(context);
      }),
      catchError((error) => {
        if (error?.status === 403) {
          // Clinic is inactive
          const current = this.currentTenant();
          if (current) {
            this.currentTenant.set({ ...current, clinica_estado: 'INACTIVO' });
          }
        }
        return of(null);
      })
    );
  }

  setSuperAdminTenant(clinicaId: number | null): Observable<TenantContext | null> {
    this.selectedTenantId.set(clinicaId);
    if (this.isBrowser) {
      if (clinicaId !== null) {
        localStorage.setItem(this.SELECTED_TENANT_ID_KEY, String(clinicaId));
      } else {
        localStorage.removeItem(this.SELECTED_TENANT_ID_KEY);
      }
    }
    return this.loadTenantContext();
  }

  saveTenantContext(context: TenantContext): void {
    this.currentTenant.set(context);
    if (this.isBrowser) {
      localStorage.setItem(this.TENANT_CONTEXT_KEY, JSON.stringify(context));
    }
  }

  clearTenant(): void {
    this.currentTenant.set(null);
    this.selectedTenantId.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(this.TENANT_CONTEXT_KEY);
      localStorage.removeItem(this.SELECTED_TENANT_ID_KEY);
    }
  }

  private getStoredTenantContext(): TenantContext | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.TENANT_CONTEXT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private getStoredSelectedTenantId(): number | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.SELECTED_TENANT_ID_KEY);
      if (!raw) return null;
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }
}
