import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

export const clinicaGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (tenantService.isClinicaActiva()) {
    return true;
  }

  return router.createUrlTree(['/clinica-inactiva']);
};
