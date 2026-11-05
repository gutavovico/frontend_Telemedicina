import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    if (authService.mustChangePassword()) {
      return router.createUrlTree(['/cambiar-contrasena-temporal']);
    }
    return true;
  }

  // Redirect to login page and preserve return url
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
