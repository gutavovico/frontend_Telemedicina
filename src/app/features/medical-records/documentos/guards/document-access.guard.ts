import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

/**
 * Guard de acceso a documentos clínicos (CU12).
 * Requiere sesión iniciada; recibe en `data.roles` la lista de roles
 * permitidos para la ruta (por defecto cualquier usuario autenticado).
 */
export const documentAccessGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
  if (allowedRoles.length === 0) {
    return true;
  }

  const role = authService.userRole();
  const normalized = allowedRoles.map((r) => r.toLowerCase());
  if (normalized.includes(role)) {
    return true;
  }

  return router.createUrlTree(['/']);
};