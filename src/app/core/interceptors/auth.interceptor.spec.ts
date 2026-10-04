import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

import { authInterceptor } from './auth.interceptor';

/**
 * Pruebas del interceptor de autenticacion (CU23).
 *
 * El caso clave es el 401 por inactividad: el servidor ya revoco la sesion, asi
 * que reintentar con un refresh daria un par nuevo que sigue apuntando a la
 * sesion revocada (ademas de un bucle). Se debe cerrar la sesion localmente y
 * navegar a login distinguiendo el motivo.
 */
describe('authInterceptor (CU23)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('access_token', 'access-1');
    localStorage.setItem('refresh_token', 'refresh-1');
    localStorage.setItem('user_profile', '{}');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('añade el token de acceso a las peticiones autenticadas', () => {
    http.get('http://localhost:8000/documentos').subscribe();

    const req = httpMock.expectOne('http://localhost:8000/documentos');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('cierra la sesión y navega a login si el servidor indica inactividad', () => {
    const navigate = vi.spyOn(router, 'navigate');

    http.get('http://localhost:8000/documentos').subscribe({ error: () => undefined });

    const req = httpMock.expectOne('http://localhost:8000/documentos');
    req.flush(
      { detail: 'Sesión cerrada por inactividad' },
      { status: 401, statusText: 'Unauthorized' }
    );

    // Se limpian las credenciales locales.
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user_profile')).toBeNull();

    // Se navega a login indicando el motivo, para poder informar al usuario.
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { inactive: 'true' } });

    // No debe intentar refrescar: el refresh devolveria otra sesion revocada.
    httpMock.expectNone('http://localhost:8000/auth/refresh');
  });

  it('renueva el token ante un 401 que no es por inactividad', () => {
    const navigate = vi.spyOn(router, 'navigate');

    http.get('http://localhost:8000/documentos').subscribe();

    httpMock
      .expectOne('http://localhost:8000/documentos')
      .flush({ detail: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = httpMock.expectOne('http://localhost:8000/auth/refresh');
    refresh.flush({ access_token: 'access-2', refresh_token: 'refresh-2' });

    // La peticion original se reintenta con el token nuevo.
    const retry = httpMock.expectOne('http://localhost:8000/documentos');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({});

    expect(navigate).not.toHaveBeenCalled();
  });

  it('cierra la sesión si el refresh también falla', () => {
    const navigate = vi.spyOn(router, 'navigate');

    http.get('http://localhost:8000/documentos').subscribe({ error: () => undefined });

    httpMock
      .expectOne('http://localhost:8000/documentos')
      .flush({ detail: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne('http://localhost:8000/auth/refresh')
      .flush({ detail: 'Refresh inválido' }, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('no intenta refrescar cuando el propio login devuelve 401', () => {
    const navigate = vi.spyOn(router, 'navigate');

    http.post('http://localhost:8000/auth/login', {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne('http://localhost:8000/auth/login')
      .flush({ detail: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone('http://localhost:8000/auth/refresh');
    // Un login fallido no debe cerrar una sesion previa ni navegar.
    expect(navigate).not.toHaveBeenCalled();
  });
});