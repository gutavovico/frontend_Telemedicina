import '@angular/compiler';
import { DatePipe } from '@angular/common';
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import type { HttpClient } from '@angular/common/http';
import { SubscriptionPaymentComponent } from './subscription-payment.component';
import { SubscriptionPaymentService } from './services/subscription-payment.service';
import type { CurrentSubscription, SubscriptionChange, ChangeQuote, PlanVersion } from './models/subscription-payment.model';

const end = '2026-02-28T00:00:00Z';
const sub: CurrentSubscription = {has_subscription:true, plan_version_id:1, estado:'ACTIVE', fecha_fin:end};
const quote: ChangeQuote = {amount:'150.00',currency:'BOB',effective_at:'2026-02-14T00:00:00Z',
  cycle_end:end,quote_token:'signed-server-token',expires_at:'2026-02-14T00:05:00Z'};
const pending: SubscriptionChange = {id:'request-1',source_version_id:1,target_version_id:2,
  operation:'IMMEDIATE',status:'WAITING_PAYMENT',amount:'150.00',effective_at:quote.effective_at,
  applied_at:null,payment_id:'pay-1',reason:null,checkout_url:'https://checkout.stripe.com/test'};
function setup() {
  const mocks = {
    getCurrentSubscription:vi.fn(()=>of<CurrentSubscription>(sub)), getActivePlans:vi.fn(()=>of<PlanVersion[]>([])),
    getPaymentHistory:vi.fn(()=>of({items:[],total:0,page:1,per_page:20})),getChanges:vi.fn(()=>of<SubscriptionChange[]>([])),
    quote:vi.fn(()=>of(quote)),change:vi.fn(()=>of(pending)),cancel:vi.fn(()=>of<SubscriptionChange>(
      {...pending,operation:'CANCEL',status:'SCHEDULED',target_version_id:null,effective_at:end,checkout_url:null})),
    createCheckout:vi.fn(()=>of({id_pago:'renew-1',monto:'250.00',moneda:'BOB',checkout_url:''})),synchronizeCheckout:vi.fn(),downloadReceiptPdf:vi.fn()
  };
  const service = mocks as unknown as SubscriptionPaymentService;
  const component = new SubscriptionPaymentComponent(service);
  vi.spyOn(component,'continueToCheckout').mockImplementation(() => undefined);
  component.ngOnInit();component.selectPlan(2);
  return {mocks,component,service};
}

describe('CU35 subscription changes',()=>{
  it('cotiza y requiere confirmación sin aplicar el plan antes del pago',()=>{
    const {mocks,component}=setup();component.mode.setValue('IMMEDIATE');component.prepareChange();
    expect(component.quoteResult()?.amount).toBe('150.00');
    expect(mocks.change).not.toHaveBeenCalled();expect(component.subscription()?.plan_version_id).toBe(1);
    component.confirmRequest();
    expect(mocks.change).toHaveBeenCalledWith(2,'IMMEDIATE',expect.any(String),'signed-server-token');
    expect(component.subscription()?.plan_version_id).toBe(1);
    expect(component.pendingCheckout()).toBe(pending.checkout_url);
  });
  it('programa el cambio con la fecha efectiva del servidor sin cobro inmediato',()=>{
    const {mocks,component}=setup();
    const scheduled:SubscriptionChange={...pending,operation:'NEXT_CYCLE',status:'SCHEDULED',effective_at:end,checkout_url:null};
    mocks.change.mockReturnValue(of(scheduled));mocks.getChanges.mockReturnValue(of([scheduled]));
    component.prepareChange();expect(mocks.quote).not.toHaveBeenCalled();component.confirmRequest();
    expect(mocks.change).toHaveBeenCalledWith(2,'NEXT_CYCLE',expect.any(String),undefined);
    expect(component.changes()[0].effective_at).toBe(end);expect(component.subscription()?.plan_version_id).toBe(1);
  });
  it('confirma cancelación al cierre sin cancelar el contrato desde el navegador',()=>{
    const {mocks,component}=setup();component.requestCancellation();
    expect(mocks.cancel).not.toHaveBeenCalled();component.confirmRequest();
    expect(mocks.cancel).toHaveBeenCalledWith(expect.any(String));
    expect(component.subscription()?.estado).toBe('ACTIVE');expect(mocks.createCheckout).not.toHaveBeenCalled();
  });
  it('reutiliza la clave de idempotencia tras un error de red',()=>{
    const {mocks,component}=setup();component.mode.setValue('IMMEDIATE');component.prepareChange();
    mocks.change.mockReturnValueOnce(throwError(()=>new Error('network')));
    component.confirmRequest();const first=mocks.change.mock.calls[0];component.confirmRequest();
    expect(mocks.change.mock.calls[1]).toEqual(first);
  });
  it('invalida la cotización al elegir otra versión',()=>{
    const {component}=setup();component.mode.setValue('IMMEDIATE');component.prepareChange();
    component.selectPlan(3);expect(component.quoteResult()).toBeNull();expect(component.confirmation()).toBeNull();
  });
  it('intercambia solo IDs y token, nunca importes calculados en el cliente',()=>{
    const http={get:vi.fn(()=>of([])),post:vi.fn(()=>of(pending))};
    const service=new SubscriptionPaymentService(http as unknown as HttpClient);
    service.change(2,'IMMEDIATE','idempotent-key','signed-token').subscribe();
    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/api/v1/subscriptions/changes'),
      {plan_version_id:2,mode:'IMMEDIATE',idempotency_key:'idempotent-key',quote_token:'signed-token'});
    service.cancel('cancel-key').subscribe();
    expect(http.post).toHaveBeenLastCalledWith(expect.stringContaining('/cancellation'),{idempotency_key:'cancel-key'});
  });
  it('muestra confirmación y fecha efectiva sin ofrecer cancelación inmediata',async()=>{
    const {service}=setup();
    TestBed.configureTestingModule({imports:[SubscriptionPaymentComponent],providers:[{provide:SubscriptionPaymentService,useValue:service}]});
    const fixture=TestBed.createComponent(SubscriptionPaymentComponent);fixture.detectChanges();
    fixture.componentInstance.requestCancellation();fixture.detectChanges();
    const panel:HTMLElement=fixture.nativeElement.querySelector('[aria-label="Confirmar operación"]');
    expect(panel.textContent).toContain('La cancelación será efectiva');
    expect(panel.textContent).toContain('Conservas el ciclo pagado');
    expect(fixture.nativeElement.textContent).not.toContain('Cancelación inmediata');
    fixture.destroy();TestBed.resetTestingModule();
  });
});


const currentVersion:PlanVersion={id:1,id_plan_version:1,plan_id:10,numero:1,nombre:'Clinica',precio_mensual:'200.00',
  moneda:'BOB',ciclo:'MENSUAL',descripcion:null,servicios_incluidos:['AGENDA_TELECONSULTA'],
  limite_medicos:10,limite_sedes:null,limite_consultas:100,limite_consultas_mes:100,
  tarifas_excedentes:[],demora_pago_dias:0,creado_por:1,creado_en:'2026-01-01'};
const published:PlanVersion={...currentVersion,id:4,id_plan_version:4,numero:2,precio_mensual:'250.00'};

describe('CU31 renewal version acceptance',()=>{
  it('reviews the published version before checkout and keeps the accepted snapshot',()=>{
    const {component,mocks}=setup();
    component.subscription.set({...sub,version:currentVersion});component.plans.set([published]);
    component.iniciarCheckout();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(component.renewalReview()?.id).toBe(4);
    expect(component.renewalReview()?.precio_mensual).toBe('250.00');
    component.plans.set([{...published,id:5,id_plan_version:5,numero:3,precio_mensual:'300.00'}]);
    component.confirmRenewal();
    expect(mocks.createCheckout).toHaveBeenCalledWith(4,'MENSUAL');
    expect(component.subscription()?.plan_version_id).toBe(1);
  });
  it('blocks renewal for scheduled cancellation',()=>{
    const {component,mocks}=setup();component.subscription.set({...sub,version:currentVersion});component.plans.set([published]);
    component.changes.set([{...pending,operation:'CANCEL',status:'SCHEDULED',target_version_id:null}]);
    component.iniciarCheckout();component.confirmRenewal();
    expect(component.renewalReview()).toBeNull();expect(mocks.createCheckout).not.toHaveBeenCalled();
  });
  it('uses the exact destination of a pending change instead of the latest offer',()=>{
    const {component,mocks}=setup();component.subscription.set({...sub,version:currentVersion});
    component.plans.set([{...published,id:5,id_plan_version:5}]);
    component.changes.set([{...pending,operation:'NEXT_CYCLE',status:'WAITING_RENEWAL',target_version_id:4,target_version:published}]);
    component.iniciarCheckout();expect(component.renewalReview()?.id).toBe(4);component.confirmRenewal();
    expect(mocks.createCheckout).toHaveBeenCalledWith(4,'MENSUAL');
  });
  it('renders price and limits before accepting payment',()=>{
    const {service}=setup();TestBed.configureTestingModule({imports:[SubscriptionPaymentComponent],providers:[{provide:SubscriptionPaymentService,useValue:service}]});
    const fixture=TestBed.createComponent(SubscriptionPaymentComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    component.subscription.set({...sub,version:currentVersion});component.plans.set([published]);component.iniciarCheckout();fixture.detectChanges();
    const panel:HTMLElement=fixture.nativeElement.querySelector('[aria-label="Confirmar renovaci\u00f3n"]');
    expect(panel.textContent).toContain('250.00 BOB / mes');expect(panel.textContent).toContain('100');
    expect(panel.textContent).toContain('Aceptar condiciones e iniciar pago');
    fixture.destroy();TestBed.resetTestingModule();
  });
});


describe('CU35 reference layout and backend states',()=>{
  function render() {
    const {mocks,service}=setup();
    const target:PlanVersion={...published,id:2,id_plan_version:2,plan_id:20,nombre:'Superior',precio_mensual:'500.00'};
    mocks.getCurrentSubscription.mockReturnValue(of({...sub,plan_nombre:'Clinica',fecha_inicio:'2026-01-31T00:00:00Z',version:currentVersion}));
    const fixturePlans=[published,target];
    mocks.getActivePlans.mockReturnValue(of(fixturePlans));
    TestBed.configureTestingModule({imports:[SubscriptionPaymentComponent],providers:[{provide:SubscriptionPaymentService,useValue:service}]});
    const fixture=TestBed.createComponent(SubscriptionPaymentComponent);
    const component=fixture.componentInstance;
    vi.spyOn(component,'continueToCheckout').mockImplementation(()=>undefined);
    fixture.detectChanges();component.selectPlan(2);fixture.detectChanges();
    return {mocks,fixture,component};
  }
  function finish(fixture:ReturnType<typeof TestBed.createComponent<SubscriptionPaymentComponent>>) {
    fixture.destroy();TestBed.resetTestingModule();
  }
  it('shows contracted and catalog versions separately with at most three cards per page',()=>{
    const {fixture,component}=render();
    component.plans.set(Array.from({length:5},(_,i)=>({...published,id:i+10,id_plan_version:i+10,nombre:'Oferta '+i})));
    fixture.detectChanges();
    const root:HTMLElement=fixture.nativeElement;
    expect(root.querySelectorAll('.plan-card')).toHaveLength(3);
    expect(root.querySelector('.contracted-card')?.textContent).toContain('200.00 BOB');
    expect(root.querySelector('.plan-card')?.textContent).toContain('250.00');
    expect(root.querySelector('.change-workspace .left-column #timing-title')).not.toBeNull();
    expect(root.querySelector('aside #summary-title')).not.toBeNull();
    expect(root.querySelector('.cancellation-card #cancel-title')).not.toBeNull();
    const next=Array.from(root.querySelectorAll('button')).find(button=>button.textContent==='Siguientes')!;
    next.click();fixture.detectChanges();expect(root.querySelectorAll('.plan-card')).toHaveLength(2);
    expect(root.textContent).not.toContain('Anual');finish(fixture);
  });
  it('renders the server adjustment before payment and keeps current plan on pending and failure',()=>{
    const {fixture,component,mocks}=render();component.mode.setValue('IMMEDIATE');component.changeMode();component.prepareChange();fixture.detectChanges();
    const root:HTMLElement=fixture.nativeElement;
    expect(root.querySelector('.summary-amount')?.textContent).toContain('150.00 BOB');
    expect(mocks.change).not.toHaveBeenCalled();
    component.confirmRequest();fixture.detectChanges();
    expect(component.continueToCheckout).toHaveBeenCalledWith(pending.checkout_url);
    expect(root.querySelector('.change-summary')?.textContent).toContain('Pago pendiente');
    expect(component.subscription()?.plan_version_id).toBe(1);
    mocks.getChanges.mockReturnValue(of([{...pending,status:'FAILED',checkout_url:null,reason:'FALLIDO'}]));
    component.loadData();fixture.detectChanges();
    expect(root.textContent).toContain('El pago falló. Se conserva el plan vigente.');
    expect(component.subscription()?.version?.precio_mensual).toBe('200.00');
    expect(root.querySelector('.payment-link')).toBeNull();finish(fixture);
  });
  it('shows scheduled effective date from backend while keeping current conditions',()=>{
    const {fixture,component,mocks}=render();
    const scheduled:SubscriptionChange={...pending,operation:'NEXT_CYCLE',status:'SCHEDULED',effective_at:end,checkout_url:null};
    mocks.change.mockReturnValue(of(scheduled));mocks.getChanges.mockReturnValue(of([scheduled]));
    component.prepareChange();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hasta entonces sigue vigente Clinica');
    component.confirmRequest();fixture.detectChanges();
    expect(component.changes()[0].effective_at).toBe(end);
    expect(fixture.nativeElement.querySelector('.change-summary').textContent).toContain('Programada');
    expect(component.subscription()?.plan_version_id).toBe(1);
    expect(component.continueToCheckout).not.toHaveBeenCalled();finish(fixture);
  });
  it('shows cancellation closing before confirmation and renders returned request state',()=>{
    const {fixture,component,mocks}=render();component.requestCancellation();fixture.detectChanges();
    expect(mocks.cancel).not.toHaveBeenCalled();
    const panel:HTMLElement=fixture.nativeElement.querySelector('.cancellation-card [aria-label="Confirmar operación"]');
    expect(panel.textContent).toContain('La cancelación será efectiva');
    expect(panel.textContent).toContain(new DatePipe('en-US').transform(end,'medium')!);
    component.confirmRequest();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.request-status').textContent).toContain('Programada');
    expect(component.latestCancellation()?.effective_at).toBe(end);
    expect(component.subscription()?.estado).toBe('ACTIVE');finish(fixture);
  });
  it('ignores a stale quote returned after selecting another plan',()=>{
    const {component,mocks}=setup();const response=new Subject<ChangeQuote>();mocks.quote.mockReturnValue(response);
    component.mode.setValue('IMMEDIATE');component.prepareChange();component.selectPlan(3);response.next(quote);
    expect(component.quoteResult()).toBeNull();expect(component.confirmation()).toBeNull();
  });
});
