import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { PublicOnboardingService } from './services/public-onboarding.service';
import { PublicOnboardingComponent } from './public-onboarding.component';
import { DeactivationRequestComponent } from '../deactivation-request/deactivation-request.component';
import {
  OnboardingResponse,
  PublicPlan,
  TrackingResponse,
  DeactivationResponse,
} from './models/public-onboarding.model';

describe('CU32 Public Health Entity Onboarding Frontend', () => {
  let service: PublicOnboardingService;
  let mockHttp: any;
  let fb: FormBuilder;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn(),
    };
    service = new PublicOnboardingService(mockHttp);
    fb = new FormBuilder();
  });

  it('obtiene planes activos y consulta seguimiento por tracking code', () => {
    const mockPlans: PublicPlan[] = [
      {
        id_plan_version: 101,
        nombre: 'Plan Básico',
        precio_mensual: 100,
        moneda: 'BOB',
        limite_medicos: 5,
        limite_consultas_mes: 50,
      },
    ];

    const mockTracking: TrackingResponse = {
      institucion: 'Clínica San Lucas',
      status: 'PENDING',
      mensaje: 'En proceso de evaluación',
      fecha_decision: null,
    };

    mockHttp.get.mockReturnValueOnce(of(mockPlans));
    mockHttp.get.mockReturnValueOnce(of(mockTracking));

    service.getPublicPlans().subscribe((plans) => {
      expect(plans.length).toBe(1);
      expect(plans[0].nombre).toBe('Plan Básico');
    });

    service.getTrackingStatus('TRK-ABC123XYZ').subscribe((res) => {
      expect(res.institucion).toBe('Clínica San Lucas');
      expect(res.status).toBe('PENDING');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/public/tenant-requests/TRK-ABC123XYZ'),
    );
  });

  it('valida formulario reactivo de alta y rechaza envíos incompletos', () => {
    const component = new PublicOnboardingComponent(fb, service);
    component.ngOnInit();

    expect(component.onboardingForm.valid).toBe(false);

    component.submitOnboarding();
    expect(component.errorMessage()).toContain('revise los campos requeridos');
    expect(component.successTrackingCode()).toBeNull();
  });

  it('envía solicitud válida multipart y recibe tracking_code en estado PENDING', () => {
    const mockResponse: OnboardingResponse = {
      id_request: 'req-uuid-1',
      tracking_code: 'TRK-998877',
      status: 'PENDING',
    };

    mockHttp.post.mockReturnValue(of(mockResponse));

    const component = new PublicOnboardingComponent(fb, service);
    component.ngOnInit();

    component.onboardingForm.setValue({
      nombre: 'Hospital Modelo',
      razon_social: 'Hospital Modelo S.A.',
      nit: '987654321',
      correo: 'contacto@hospitalmodelo.com',
      telefono: '71122334',
      direccion: 'Av. Las Palmeras 100',
      responsable_nombre: 'Dra. Patricia Silva',
      responsable_correo: 'psilva@hospitalmodelo.com',
      responsable_telefono: '71122335',
      plan_version_id: 101,
    });

    component.submitOnboarding();

    expect(component.successTrackingCode()).toBe('TRK-998877');
    expect(component.errorMessage()).toBeNull();
    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/public/tenant-requests'),
      expect.any(FormData),
    );
    const submitted = mockHttp.post.mock.calls[0][1] as FormData;
    expect(submitted.get('plan_version_id')).toBe('101');
  });

  it('consulta de seguimiento procesa resultado y error 404', () => {
    const component = new PublicOnboardingComponent(fb, service);
    component.ngOnInit();

    // 1. Consulta exitosa
    mockHttp.get.mockReturnValueOnce(
      of({
        institucion: 'Clínica Los Pinos',
        status: 'APPROVED',
        mensaje: 'Aprobado formalmente',
        fecha_decision: '2026-04-12T10:00:00Z',
      }),
    );

    component.trackingInput.set('TRK-VALID123');
    component.buscarSeguimiento();

    expect(component.trackingResult()?.institucion).toBe('Clínica Los Pinos');
    expect(component.trackingResult()?.status).toBe('APPROVED');
    expect(component.trackingError()).toBeNull();

    // 2. Consulta 404
    mockHttp.get.mockReturnValueOnce(
      throwError(() => ({ status: 404, error: { detail: 'Código no encontrado' } })),
    );

    component.trackingInput.set('TRK-INVALID');
    component.buscarSeguimiento();

    expect(component.trackingResult()).toBeNull();
    expect(component.trackingError()).toContain('No se encontró ninguna solicitud');
  });

  it('componente de solicitud de baja valida confirmación y envía motivo al backend', () => {
    const mockDeactResponse: DeactivationResponse = {
      id_deactivation: 'deact-123',
      status: 'PENDING',
      message: 'Solicitud de baja registrada correctamente.',
    };

    mockHttp.post.mockReturnValue(of(mockDeactResponse));

    const deactComponent = new DeactivationRequestComponent(fb, service);

    // Sin confirmación
    deactComponent.deactForm.patchValue({
      motivo: 'Motivo largo de cierre institucional',
      confirmacion: false,
    });
    deactComponent.submitDeactivation();
    expect(deactComponent.errorMessage()).toContain('detalle el motivo formal y acepte');

    // Con confirmación
    deactComponent.deactForm.patchValue({
      confirmacion: true,
    });
    deactComponent.submitDeactivation();

    expect(deactComponent.successMessage()).toContain('Solicitud de baja registrada correctamente');
    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/deactivation-requests'),
      { motivo: 'Motivo largo de cierre institucional' },
    );
  });
});
