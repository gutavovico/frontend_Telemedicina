import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

/**
 * Guard de acceso a tratamientos (CU17).
 * Requiere sesión autenticada; autoriza según el rol configurado
 * o por defecto a médico y paciente (el contrato backend restringe terminantemente
 * tratamientos a MEDICO y PACIENTE, excluyendo admin y recepción).
 */
export const treatmentAccessGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
  if (allowedRoles.length === 0) {
    const currentRole = authService.getUserRole().toLowerCase();
    if (['doctor', 'paciente'].includes(currentRole)) {
      return true;
    }
    return router.createUrlTree(['/']);
  }

  const role = authService.getUserRole().toLowerCase();
  const normalized = allowedRoles.map((r) => r.toLowerCase());
  if (normalized.includes(role)) {
    return true;
  }

  return router.createUrlTree(['/']);
};
