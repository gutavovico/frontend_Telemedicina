import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  provideRouter,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { PlanesPage } from './planes-page';
import { OpcionesPlanes, Plan, PlanCreate } from '../../../core/models/plan.models';
import { superAdminGuard } from '../../../core/guards/super-admin.guard';
import { TenantService } from '../../../core/services/tenant.service';
import { routes } from '../../../app.routes';

const url = 'http://localhost:8000/api/v1/planes';
const options: OpcionesPlanes = {
  moneda: 'BOB',
  ciclo: 'MENSUAL',
  servicios: [{ codigo: 'LABORATORIO', nombre: 'Laboratorio' }],
  recursos: [
    { recurso: 'MEDICOS', unidad: 'MEDICO_CICLO_MENSUAL', nombre: 'Médicos' },
    { recurso: 'SEDES', unidad: 'SEDE_CICLO_MENSUAL', nombre: 'Sedes' },
    { recurso: 'CONSULTAS', unidad: 'CONSULTA', nombre: 'Consultas' },
  ],
};
const plan: Plan = {
  id: 10,
  codigo: 'TEST',
  activo: true,
  version_actual: 1,
  creado_en: '2026-11-03T12:00:00Z',
  actualizado_en: '2026-11-03T12:00:00Z',
  version: {
    id: 20,
    plan_id: 10,
    numero: 1,
    nombre: 'Plan de prueba',
    descripcion: null,
    precio_mensual: '123.45',
    moneda: 'BOB',
    ciclo: 'MENSUAL',
    servicios_incluidos: ['LABORATORIO'],
    limite_medicos: 3,
    limite_sedes: 0,
    limite_consultas: null,
    tarifas_excedentes: [],
    demora_pago_dias: 0,
    creado_por: 100,
    creado_en: '2026-11-03T12:00:00Z',
  },
};

describe('CU34 catálogo conectado', () => {
  let fixture: ComponentFixture<PlanesPage>;
  let page: PlanesPage;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PlanesPage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(url + '/opciones').flush(options);
    http.expectOne((r) => r.url === url).flush({ items: [plan], total: 1, page: 1, per_page: 10 });
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  function fillNew() {
    page.nuevo();
    page.form.patchValue({
      codigo: 'TEST2',
      nombre: 'Nuevo de prueba',
      precio_mensual: '99.90',
      demora_pago_dias: '0',
      MEDICOS: { limite: '3' },
      SEDES: { limite: '0' },
      CONSULTAS: { ilimitado: true },
    });
    page.syncResources();
  }
  function edit() {
    page.abrir(plan, true);
    http.expectOne(url + '/10').flush(plan);
  }
  function finishList() {
    http.expectOne((r) => r.url === url).flush({ items: [plan], total: 1, page: 1, per_page: 10 });
  }

  it('muestra catálogo sin campos anuales ni conteos de instituciones', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Catálogo de planes de suscripción');
    expect(text).toContain('123,45');
    expect(text).not.toContain('Anual');
    expect(page.loading()).toBe(false);
  });
  it('valida campos, cantidades, precisión y límite explícito', () => {
    fillNew();
    expect(page.form.valid).toBe(true);
    page.form.controls.precio_mensual.setValue('1.001');
    expect(page.form.invalid).toBe(true);
    page.form.controls.precio_mensual.setValue('NaN');
    expect(page.form.invalid).toBe(true);
    page.form.controls.precio_mensual.setValue('0');
    page.form.controls.MEDICOS.controls.limite.setValue('-1');
    expect(page.form.invalid).toBe(true);
    page.form.controls.MEDICOS.controls.ilimitado.setValue(true);
    page.syncResources();
    expect(page.form.valid).toBe(true);
    expect(page.form.controls.MEDICOS.controls.excedente.disabled).toBe(true);
    page.guardar();
    const request = http.expectOne(url);
    const body = request.request.body as PlanCreate;
    expect(body.precio_mensual).toBe('0');
    expect(body.limite_medicos).toBeNull();
    expect(body.limite_sedes).toBe(0);
    expect(body.ciclo).toBe('MENSUAL');
    request.flush(plan);
    finishList();
  });
  it('valida y envía excedentes con unidades correctas, sin números monetarios', () => {
    fillNew();
    const controls = page.form.controls.MEDICOS.controls;
    controls.excedente.setValue(true);
    page.syncResources();
    expect(page.form.invalid).toBe(true);
    controls.precio.setValue('0.10');
    page.guardar();
    const request = http.expectOne(url);
    expect(request.request.body.tarifas_excedentes).toEqual([
      { recurso: 'MEDICOS', unidad: 'MEDICO_CICLO_MENSUAL', precio: '0.10' },
    ]);
    request.flush(plan);
    finishList();
  });
  it('evita doble envío y conserva los datos al fallar', () => {
    fillNew();
    page.guardar();
    page.guardar();
    const request = http.expectOne(url);
    expect(page.saving()).toBe(true);
    request.flush({ detail: 'Servicio no disponible' }, { status: 503, statusText: 'Unavailable' });
    expect(page.saving()).toBe(false);
    expect(page.form.controls.precio_mensual.value).toBe('99.90');
    expect(page.error()).toContain('Servicio');
  });
  it('envía version_base y permite recarga explícita tras un conflicto', () => {
    edit();
    page.form.controls.nombre.setValue('Edición local');
    page.guardar();
    const request = http.expectOne(url + '/10/versiones');
    expect(request.request.body.version_base).toBe(1);
    expect(request.request.body.codigo).toBeUndefined();
    request.flush(
      { detail: 'El plan cambió', code: 'PLAN_STALE_VERSION' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(page.conflict()).toBe(true);
    expect(page.form.controls.nombre.value).toBe('Edición local');
    page.guardar();
    http.expectNone(url + '/10/versiones');
    page.abrir(plan, true);
    http
      .expectOne(url + '/10')
      .flush({
        ...plan,
        version_actual: 2,
        version: { ...plan.version, numero: 2, nombre: 'Versión remota' },
      });
    expect(page.conflict()).toBe(false);
    expect(page.form.controls.nombre.value).toBe('Versión remota');
  });
  it('consulta historial paginado y detalle histórico de solo lectura', () => {
    edit();
    page.historial();
    const request = http.expectOne((r) => r.url === url + '/10/versiones');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ items: [plan.version], total: 1, page: 1, per_page: 10 });
    page.verVersion(1);
    http.expectOne(url + '/10/versiones/1').flush(plan.version);
    expect(page.form.disabled).toBe(true);
    expect(page.historical()?.id).toBe(20);
    expect(page.mode()).toBe('view');
  });
  it('no edita planes desactivados', () => {
    page.abrir({ ...plan, activo: false }, true);
    http.expectOne(url + '/10').flush({ ...plan, activo: false });
    expect(page.mode()).toBe('view');
    page.guardar();
    http.expectNone(url + '/10/versiones');
  });
  it('exige confirmar desactivación y permite cancelarla', () => {
    page.pedirDesactivar(plan);
    http.expectNone(url + '/10/estado');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
    page.confirm.set(null);
    page.desactivar();
    http.expectNone(url + '/10/estado');
    page.pedirDesactivar(plan);
    page.desactivar();
    page.desactivar();
    const request = http.expectOne(url + '/10/estado');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ activo: false });
    request.flush({ ...plan, activo: false });
    finishList();
    expect(page.confirm()).toBeNull();
    expect(page.selected()?.activo).toBe(false);
  });
  it('aplica búsqueda y filtro con paginación; muestra error y vacío', () => {
    page.search.setValue('Prueba');
    page.estado.setValue('ACTIVO');
    page.load(2);
    const request = http.expectOne((r) => r.url === url);
    expect(request.request.params.get('q')).toBe('Prueba');
    expect(request.request.params.get('estado')).toBe('ACTIVO');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ detail: 'Denegado' }, { status: 403, statusText: 'Forbidden' });
    expect(page.listError()).toContain('superadministrador');
    page.load();
    http.expectOne((r) => r.url === url).flush({ items: [], total: 0, page: 1, per_page: 10 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay planes para mostrar');
  });
  it('ignora respuestas de lista y panel que llegaron fuera de orden', () => {
    page.load(2);
    const old = http.expectOne((r) => r.url === url);
    page.load(1);
    const current = http.expectOne((r) => r.url === url);
    current.flush({ items: [plan], total: 1, page: 1, per_page: 10 });
    old.flush({ items: [], total: 0, page: 2, per_page: 10 });
    expect(page.page()).toBe(1);
    page.abrir(plan);
    const detail = http.expectOne(url + '/10');
    page.nuevo();
    detail.flush(plan);
    expect(page.mode()).toBe('new');
  });
});

describe('CU34 permisos de navegación', () => {
  it('usa superAdminGuard en la ruta y rechaza contexto sin privilegio', () => {
    const isSuperAdmin = signal(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TenantService, useValue: { isSuperAdmin } }],
    });
    const route = routes
      .find((r) => r.path === 'admin')
      ?.children?.find((r) => r.path === 'planes');
    expect(route?.canActivate).toContain(superAdminGuard);
    const run = () =>
      TestBed.runInInjectionContext(() =>
        superAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    expect(run()).toEqual(TestBed.inject(Router).createUrlTree(['/admin/dashboard']));
    isSuperAdmin.set(true);
    expect(run()).toBe(true);
  });
});
