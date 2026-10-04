import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

export const permissionsGuard: CanActivateFn = (route) => {
  const permissionsService = inject(PermissionsService);
  const router = inject(Router);

  const requiredPermissions = route.data['permissions'] as string[] | string | undefined;
  if (!requiredPermissions) {
    return true;
  }

  const permissionsList = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  const hasAccess = permissionsService.hasAnyPermission(permissionsList);

  if (hasAccess) {
    return true;
  }

  return router.createUrlTree(['/sin-permisos']);
};
