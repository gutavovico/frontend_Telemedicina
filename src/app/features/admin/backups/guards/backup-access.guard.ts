import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { normalizeAppRole } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';

/**
 * Acceso a /admin/backups: solo ADMIN de clínica con perfil fresco
 * verificado. El Super Administrador solo gestiona clínicas y tiene
 * denegado el acceso (el backend responde 403). Sigue el patrón de
 * reports-access.guard.
 */
export const backupAccessGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const tenant = inject(TenantService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (tenant.isSuperAdmin()) {
    return router.createUrlTree(['/']);
  }
  return auth.fetchUserProfile().pipe(
    map((user) => {
      if (
        user &&
        normalizeAppRole(user.rol) === 'admin' &&
        user.estado.toUpperCase() === 'ACTIVO'
      ) {
        return true;
      }
      return router.createUrlTree(['/']);
    }),
  );
};
