import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';
import { of, switchMap } from 'rxjs';

export const tenantGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (tenantService.currentTenant()) {
    return true;
  }

  return tenantService.loadTenantContext().pipe(
    switchMap((context) => {
      if (context) {
        return of(true);
      }
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    })
  );
};
