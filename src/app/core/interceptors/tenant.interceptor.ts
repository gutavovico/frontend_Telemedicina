import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '../services/tenant.service';

const EXCLUDED_PATHS = [
  '/public/',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/recuperar',
];

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const isExcluded = EXCLUDED_PATHS.some((path) => req.url.includes(path));
  if (isExcluded) {
    return next(req);
  }

  const tenantService = inject(TenantService);
  const selectedTenantId = tenantService.selectedTenantId();

  if (selectedTenantId !== null && selectedTenantId !== undefined) {
    const modifiedReq = req.clone({
      headers: req.headers.set('X-Tenant-ID', String(selectedTenantId)),
    });
    return next(modifiedReq);
  }

  return next(req);
};
