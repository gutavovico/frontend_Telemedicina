import type { HttpClient } from '@angular/common/http';
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { SubscriptionPaymentService } from './services/subscription-payment.service';
import { SubscriptionPaymentComponent } from './subscription-payment.component';
import {
  CurrentSubscription,
  PlanVersion,
  SubscriptionPaymentHistoryResponse,
  CheckoutResponse,
} from './models/subscription-payment.model';

describe('CU31 Subscription Payment Frontend', () => {
  let service: SubscriptionPaymentService;
  let mockHttp: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
    };
    service = new SubscriptionPaymentService(mockHttp as unknown as HttpClient);
  });

  it('obtiene la suscripción actual y planes activos', () => {
    const mockSub: CurrentSubscription = {
      has_subscription: true,
      id_suscripcion: 'sub-1',
      tenant_id: 'tenant-10',
      plan_version_id: 1,
      plan_nombre: 'Plan Profesional',
      estado: 'ACTIVE',
      ciclo: 'MENSUAL',
      fecha_inicio: '2026-04-01T00:00:00Z',
      fecha_fin: '2026-05-01T00:00:00Z',
      derived_status: 'ACTIVE',
      limite_medicos: 10,
      limite_consultas_mes: 100,
    };

    const mockPlans: PlanVersion[] = [
      {
        ...{id:1,plan_id:1,numero:1,creado_por:1,creado_en:'2026-01-01T00:00:00Z',
          descripcion:null,ciclo:'MENSUAL' as const,servicios_incluidos:[],limite_sedes:null,
          limite_consultas:100,tarifas_excedentes:[],demora_pago_dias:0},
        id_plan_version: 1,
        nombre: 'Plan Profesional',
        precio_mensual: '100.00',
        moneda: 'BOB',
        limite_medicos: 10,
        limite_consultas_mes: 100,
      },
    ];

    mockHttp.get.mockReturnValueOnce(of(mockSub));
    mockHttp.get.mockReturnValueOnce(of(mockPlans));

    service.getCurrentSubscription().subscribe((sub) => {
      expect(sub.tenant_id).toBe('tenant-10');
      expect(sub.plan_nombre).toBe('Plan Profesional');
    });

    service.getActivePlans().subscribe((plans) => {
      expect(plans.length).toBe(1);
      expect(plans[0].precio_mensual).toBe('100.00');
    });
  });

  it('inicia checkout enviando plan_version_id y billing_cycle al backend', () => {
    const mockCheckout: CheckoutResponse = {
      id_pago: 'pay-001',
      checkout_url: 'https://checkout.stripe.com/pay/cs_test_123',
      monto: '100.00',
      moneda: 'BOB',
    };

    mockHttp.post.mockReturnValue(of(mockCheckout));

    service.createCheckout(1, 'MENSUAL').subscribe((res) => {
      expect(res.id_pago).toBe('pay-001');
      expect(res.checkout_url).toContain('checkout.stripe.com');
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/checkout'),
      { plan_version_id: 1, cycle: 'MENSUAL' },
    );
    service.createCheckout(1).subscribe();
    expect(mockHttp.post).toHaveBeenLastCalledWith(expect.stringContaining('/checkout'),{plan_version_id:1,cycle:'MONTHLY'});
  });

  it('componente carga datos iniciales correctamente', () => {
    const mockSub: CurrentSubscription = {
      has_subscription: true,
      id_suscripcion: 'sub-1',
      tenant_id: 'tenant-10',
      plan_version_id: 1,
      plan_nombre: 'Plan Profesional',
      estado: 'ACTIVE',
      ciclo: 'MENSUAL',
      fecha_inicio: '2026-04-01T00:00:00Z',
      fecha_fin: '2026-05-01T00:00:00Z',
      derived_status: 'ACTIVE',
      limite_medicos: 10,
      limite_consultas_mes: 100,
    };

    const mockPlans: PlanVersion[] = [
      {
        ...{id:1,plan_id:1,numero:1,creado_por:1,creado_en:'2026-01-01T00:00:00Z',
          descripcion:null,ciclo:'MENSUAL' as const,servicios_incluidos:[],limite_sedes:null,
          limite_consultas:100,tarifas_excedentes:[],demora_pago_dias:0},
        id_plan_version: 1,
        nombre: 'Plan Profesional',
        precio_mensual: '100.00',
        moneda: 'BOB',
        limite_medicos: 10,
        limite_consultas_mes: 100,
      },
    ];

    const mockHistory: SubscriptionPaymentHistoryResponse = {
      items: [
        {
          id_pago: 'p-1',
          plan_version_id: 1, version: mockPlans[0], purpose: 'RENEWAL', application_status: 'APPLIED',
          monto: '100.00',
          moneda: 'BOB',
          ciclo: 'MENSUAL',
          estado: 'PAGADO',
          numero_factura: 'FAC-2026-0001',
          fecha_creacion: '2026-04-01T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
    };

    const mockService = {
      getChanges: vi.fn().mockReturnValue(of([])),
      getCurrentSubscription: vi.fn().mockReturnValue(of(mockSub)),
      getActivePlans: vi.fn().mockReturnValue(of(mockPlans)),
      getPaymentHistory: vi.fn().mockReturnValue(of(mockHistory)),
      createCheckout: vi.fn(),
      downloadReceiptPdf: vi.fn(),
    } as unknown as SubscriptionPaymentService;

    const component = new SubscriptionPaymentComponent(mockService);
    component.ngOnInit();

    expect(component.subscription()?.plan_nombre).toBe('Plan Profesional');
    expect(component.plans().length).toBe(1);
    expect(component.payments().length).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('componente valida selección antes de checkout y procesa respuesta', () => {
    const mockService = {
      getChanges: vi.fn().mockReturnValue(of([])),
      getCurrentSubscription: vi.fn().mockReturnValue(of(null)),
      getActivePlans: vi.fn().mockReturnValue(of([])),
      getPaymentHistory: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, per_page: 20 })),
      createCheckout: vi.fn().mockReturnValue(
        of({
          id_pago: 'pay-new',
          checkout_url: '',
          monto: '1000.00',
          moneda: 'BOB',
        }),
      ),
      downloadReceiptPdf: vi.fn(),
    } as unknown as SubscriptionPaymentService;

    const component = new SubscriptionPaymentComponent(mockService);
    component.selectedPlanId.set(null);
    component.iniciarCheckout();

    expect(component.errorMessage()).toBe('Por favor, selecciona un plan');

    component.plans.set([{id:2,id_plan_version:2,plan_id:2,numero:1,nombre:'Seleccionado',precio_mensual:'1000.00',moneda:'BOB',ciclo:'MENSUAL',descripcion:null,servicios_incluidos:[],limite_medicos:1,limite_sedes:null,limite_consultas:10,limite_consultas_mes:10,tarifas_excedentes:[],demora_pago_dias:0,creado_por:1,creado_en:'2026-01-01'}]);
    component.selectedPlanId.set(2);
    component.selectedCycle.set('MENSUAL');
    component.iniciarCheckout();

    expect(mockService.createCheckout).not.toHaveBeenCalled();
    expect(component.renewalReview()?.precio_mensual).toBe('1000.00');
    component.confirmRenewal();
    expect(mockService.createCheckout).toHaveBeenCalledWith(2, 'MENSUAL');
    expect(component.statusMessage()).toContain('1000.00 BOB');
  });
});
