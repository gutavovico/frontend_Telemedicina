import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { PaymentCheckoutComponent } from './payment-checkout/payment-checkout.component';
import { PaymentHistoryComponent } from './payment-history/payment-history.component';
import { PaymentResultComponent } from './payment-result/payment-result.component';
import { CheckoutResponse, Pago } from './payments.models';
import { PaymentsService } from './payments.service';

function pagoFixture(overrides: Partial<Pago> = {}): Pago {
  return {
    id_pago: 1,
    id_usuario: 15,
    id_cita: 38,
    monto: '120.50',
    moneda: 'BOB',
    metodo_pago: 'TARJETA',
    pasarela: 'STRIPE',
    referencia_transaccion: 'pi_test_123',
    fecha_pago: '2026-11-04T10:00:00',
    estado: 'PAGADO',
    url_checkout: null,
    expira_en: null,
    created_at: '2026-11-04T09:55:00',
    cita_fecha: '2026-11-10',
    cita_hora: '09:00',
    medico_nombre: 'Dr. Roberto Gómez',
    especialidad_nombre: 'Cardiología',
    tipo_consulta: 'TELEMEDICINA',
    comprobante: {
      id_comprobante: 5,
      id_pago: 1,
      numero_comprobante: 'REC-20261104-000001',
      tipo_comprobante: 'RECIBO',
      fecha_emision: '2026-11-04T10:00:00',
      archivo_url: 'comprobantes/REC-20261104-000001.pdf',
      estado: 'EMITIDO',
    },
    ...overrides,
  };
}

function checkoutFixture(overrides: Partial<CheckoutResponse> = {}): CheckoutResponse {
  return {
    ...pagoFixture({ estado: 'PENDIENTE', fecha_pago: null, referencia_transaccion: null, comprobante: null }),
    qr_url: 'https://backend-telemedicina.onrender.com/pagos/qr/token-abc',
    qr_payload: 'https://backend-telemedicina.onrender.com/pagos/qr/token-abc',
    simulado: false,
    ...overrides,
  };
}

function pdfResponse(): HttpResponse<Blob> {
  return new HttpResponse({
    body: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    headers: new HttpHeaders({
      'Content-Disposition': 'attachment; filename="REC-20261104-000001.pdf"',
      'Content-Type': 'application/pdf',
    }),
  });
}

const authMock = {
  currentUser: signal({ nombres: 'Ana', apellidos: 'Gómez', rol: 'PACIENTE', estado: 'ACTIVO', id_clinica: 1 }),
  isAuthenticated: signal(true),
  isAdmin: signal(false),
  isDoctor: signal(false),
  isPaciente: signal(true),
  isRecepcion: signal(false),
  profileVerified: signal(true),
  userPhoto: signal(null),
  userDisplayName: signal('Ana Gómez'),
  userInitials: signal('AG'),
  logout: vi.fn(),
};

const tenantMock = {
  clinicaNombre: signal('Hospital San Juan de Dios'),
  currentTenant: signal(null),
  isSuperAdmin: signal(false),
};

describe('CU19 pantallas de pagos (web)', () => {
  let payments: {
    estadoPasarela: ReturnType<typeof vi.fn>;
    listarPendientes: ReturnType<typeof vi.fn>;
    listarPagos: ReturnType<typeof vi.fn>;
    crearCheckout: ReturnType<typeof vi.fn>;
    sincronizar: ReturnType<typeof vi.fn>;
    simularPago: ReturnType<typeof vi.fn>;
    descargarComprobante: ReturnType<typeof vi.fn>;
    descargarQr: ReturnType<typeof vi.fn>;
  };

  function montar<T>(componente: Type<T>, params: Record<string, string> = {}): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [componente],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(params),
              queryParamMap: convertToParamMap(params),
            },
          },
        },
        { provide: AuthService, useValue: authMock },
        { provide: TenantService, useValue: tenantMock },
        { provide: PaymentsService, useValue: payments },
      ],
    });
    return TestBed.createComponent(componente);
  }

  beforeEach(() => {
    payments = {
      estadoPasarela: vi.fn(() => of({ habilitada: true, modo: 'STRIPE_SANDBOX', moneda: 'BOB', pasarela: 'STRIPE' })),
      listarPendientes: vi.fn(() =>
        of({
          total: 1,
          items: [
            {
              id_cita: 38,
              fecha_cita: '2026-11-10',
              hora_inicio: '09:00',
              hora_fin: '09:30',
              medico_nombre: 'Dr. Roberto Gómez',
              especialidad_nombre: 'Cardiología',
              tipo_consulta: 'TELEMEDICINA',
              estado_cita: 'PENDIENTE',
              monto: '120.50',
              moneda: 'BOB',
              estado_pago: null,
              id_pago: null,
            },
          ],
        })
      ),
      listarPagos: vi.fn(() => of({ total: 1, items: [pagoFixture()] })),
      crearCheckout: vi.fn(() => of(checkoutFixture())),
      sincronizar: vi.fn(() => of(pagoFixture())),
      simularPago: vi.fn(() => of(pagoFixture())),
      descargarComprobante: vi.fn(() => of(pdfResponse())),
      descargarQr: vi.fn(() => of(new Blob(['PNG'], { type: 'image/png' }))),
    };

    (window.URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:cu19');
    (window.URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('historial: muestra citas pendientes e historial con comprobante descargable', () => {
    const fixture = montar(PaymentHistoryComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(payments.listarPagos).toHaveBeenCalled();
    expect(payments.listarPendientes).toHaveBeenCalled();
    expect(root.textContent).toContain('Citas pendientes de pago');
    expect(root.textContent).toContain('Pagar ahora');
    expect(root.textContent).toContain('Dr. Roberto Gómez');
    expect(root.textContent).toContain('Bs. 120.50');
    expect(root.textContent).toContain('REC-20261104-000001');
    expect(root.querySelector('a[href="/pagos/checkout/38"]')).toBeTruthy();

    const botonPdf = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('PDF'));
    expect(botonPdf).toBeTruthy();
    botonPdf!.click();
    expect(payments.descargarComprobante).toHaveBeenCalledWith(1);
  });

  it('historial: muestra el mensaje de error del backend sin romper la pantalla', () => {
    payments.listarPagos.mockReturnValue(throwError(() => ({ error: { detail: 'Sesión expirada' } })));
    payments.listarPendientes.mockReturnValue(of({ total: 0, items: [] }));

    const fixture = montar(PaymentHistoryComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Sesión expirada');
    expect(root.textContent).toContain('Mis pagos');
  });

  it('checkout: crea la sesión web, muestra el resumen y el QR', () => {
    const fixture = montar(PaymentCheckoutComponent, { idCita: '38' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(payments.crearCheckout).toHaveBeenCalledWith(38, 'WEB');
    expect(root.textContent).toContain('Resumen de la cita');
    expect(root.textContent).toContain('Dr. Roberto Gómez');
    expect(root.textContent).toContain('Cardiología');
    expect(root.textContent).toContain('Bs. 120.50');
    expect(root.textContent).toContain('Pagar con tarjeta en Stripe');
    expect(root.textContent).toContain('Pago con QR');
    expect(root.querySelector('img[alt="Código QR de pago"]')).toBeTruthy();
    expect(payments.descargarQr).toHaveBeenCalledWith(1);
  });

  it('checkout: en modo demostración confirma el pago y muestra el comprobante', () => {
    payments.crearCheckout.mockReturnValue(of(checkoutFixture({ simulado: true })));

    const fixture = montar(PaymentCheckoutComponent, { idCita: '38' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Modo demostración');
    const boton = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar pago (demostración)')
    );
    expect(boton).toBeTruthy();
    boton!.click();
    fixture.detectChanges();

    expect(payments.simularPago).toHaveBeenCalledWith(1);
    expect(root.textContent).toContain('¡Pago registrado correctamente!');
    expect(root.textContent).toContain('REC-20261104-000001');
    expect(root.textContent).toContain('Descargar comprobante PDF');
  });

  it('checkout: muestra error cuando la pasarela rechaza la cita', () => {
    payments.crearCheckout.mockReturnValue(
      throwError(() => ({ error: { detail: 'La cita ya fue pagada' } }))
    );

    const fixture = montar(PaymentCheckoutComponent, { idCita: '38' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('No se pudo iniciar el pago');
    expect(root.textContent).toContain('La cita ya fue pagada');
  });

  it('resultado: verifica el pago y permite descargar el PDF', () => {
    const fixture = montar(PaymentResultComponent, { pago: '1' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(payments.sincronizar).toHaveBeenCalledWith(1);
    expect(root.textContent).toContain('¡Pago completado!');
    expect(root.textContent).toContain('Bs. 120.50');
    expect(root.textContent).toContain('REC-20261104-000001');

    const boton = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Descargar comprobante PDF')
    );
    boton!.click();
    expect(payments.descargarComprobante).toHaveBeenCalledWith(1);
  });

  it('resultado: informa cuando Stripe aún no confirma el pago', () => {
    payments.sincronizar.mockReturnValue(of(pagoFixture({ estado: 'PENDIENTE', comprobante: null })));

    const fixture = montar(PaymentResultComponent, { pago: '1' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Pago pendiente de confirmación');
    expect(root.textContent).toContain('Verificar nuevamente');
  });
});
