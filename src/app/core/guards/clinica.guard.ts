import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

export const clinicaGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (tenantService.isClinicaActiva()) {
    return true;
  }

  const contexto = tenantService.currentTenant();
  const rol = (contexto?.rol || '').toUpperCase();

  // `clinica_id: null` con rol médico significa "invitación CU29 pendiente",
  // no "clínica suspendida". Llevarlo a /clinica-inactiva sería un callejón
  // sin salida: desde ahí no puede aceptar la invitación.
  if (!contexto?.clinica_id && (rol.includes('MEDIC') || rol.includes('DOCTOR'))) {
    return router.createUrlTree(['/mis-vinculaciones-medico']);
  }

  return router.createUrlTree(['/clinica-inactiva']);
};
