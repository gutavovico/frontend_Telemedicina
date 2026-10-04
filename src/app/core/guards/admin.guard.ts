import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  // Super Admin siempre tiene acceso al panel de administración
  if (tenantService.isSuperAdmin()) {
    return true;
  }

  if (!authService.isAdmin()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
