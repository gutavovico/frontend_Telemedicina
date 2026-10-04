import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

/**
 * Permite el acceso solo a Admin de clínica (no Super Admin).
 * El Super Admin es vista global SaaS y debe usar /admin/clinicas.
 */
export const clinicAdminGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (!tenantService.isSuperAdmin()) {
    return true;
  }

  return router.createUrlTree(['/admin/clinicas']);
};
