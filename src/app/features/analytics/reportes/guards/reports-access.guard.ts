import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { normalizeAppRole } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';

/** The backend remains authoritative for active role and clinic status. */
export const reportsAccessGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return auth.fetchUserProfile().pipe(
    map((user) => {
      if (
        user &&
        normalizeAppRole(user.rol) === 'admin' &&
        user.estado.toUpperCase() === 'ACTIVO' &&
        typeof user.id_clinica === 'number' &&
        user.id_clinica > 0
      ) {
        return true;
      }
      return router.createUrlTree(['/']);
    }),
  );
};
