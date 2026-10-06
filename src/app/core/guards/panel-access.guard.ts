import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';

/**
 * Puerta del panel /admin: superadmin, admin, recepción y médico.
 * Paciente usa sus propias vistas (no entra al panel).
 */
export const panelGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (
    tenantService.isSuperAdmin() ||
    authService.isAdmin() ||
    authService.isRecepcion() ||
    authService.isDoctor()
  ) {
    return true;
  }

  return router.createUrlTree(['/']);
};

/**
 * Solo admin de clínica (excluye superadmin, que tiene /admin/clinicas,
 * y recepción). Para CU02/CU26/CU04/CU21 y dashboard.
 */
export const adminOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

/**
 * Staff operativo y clínico: admin, recepción y médico
 * (CU03/CU05/CU09/CU12/CU15/CU16/CU25/CU28 según backend).
 * Excluye superadmin (vista global SaaS).
 */
export const staffGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin() || authService.isRecepcion() || authService.isDoctor()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

/** La HCE admite lectura de médico, admin y paciente (solo su historia en API). */
export const clinicalReadGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.isDoctor() || authService.isAdmin() || authService.isPaciente()
    ? true : router.createUrlTree(['/']);
};

/** El registro de una consulta clínica corresponde exclusivamente al médico. */
export const clinicalWriteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.isDoctor() ? true : router.createUrlTree(['/']);
};
