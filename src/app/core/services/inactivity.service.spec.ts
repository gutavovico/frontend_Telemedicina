import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InactivityService } from './inactivity.service';

/**
 * Pruebas del aviso y la reconciliación del reloj de inactividad (CU23).
 *
 * El temporizador local es una aproximación: cuando la pestaña queda suspendida
 * el navegador recorta los temporizadores y la cuenta atrás se desajusta. Estos
 * casos fijan que el servidor manda y que el aviso aparece a tiempo.
 *
 * Se usan los fake timers de Vitest y no `fakeAsync`, porque el proyecto es
 * zoneless (no incluye zone.js) y ejecuta las pruebas con Vitest.
 */
describe('InactivityService (CU23)', () => {
  let service: InactivityService;
  let httpMock: HttpTestingController;
  let expirado = false;

  const SEGUNDO = 1000;

  beforeEach(() => {
    expirado = false;
    vi.useFakeTimers();
    localStorage.setItem('access_token', 'token-de-prueba');

    TestBed.configureTestingModule({
      providers: [
        InactivityService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(InactivityService);
    httpMock = TestBed.inject(HttpTestingController);
    service.expired$.subscribe(() => (expirado = true));
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('no expira de inmediato al iniciar', () => {
    service.start(false);

    vi.advanceTimersByTime(60 * SEGUNDO);

    expect(expirado).toBe(false);
  });

  it('muestra el aviso con cuenta regresiva antes de expirar', () => {
    service.start(false);

    // 15 min menos el margen de aviso de 60 s: el aviso debe verse.
    vi.advanceTimersByTime((15 * 60 - 60) * SEGUNDO);
    expect(service.showWarning()).toBe(true);
    expect(service.warningSeconds()).toBe(60);

    // Al llegar a cero se cierra la sesión.
    vi.advanceTimersByTime(60 * SEGUNDO);
    expect(expirado).toBe(true);
    expect(service.showWarning()).toBe(false);
  });

  it('continuar la sesión renueva en el servidor y retrasa el cierre', () => {
    service.start(false);

    vi.advanceTimersByTime((15 * 60 - 60) * SEGUNDO);
    expect(service.showWarning()).toBe(true);

    service.continueSession();
    expect(service.showWarning()).toBe(false);
    expect(service.warningSeconds()).toBeNull();

    // Continuar debe RENOVAR en el servidor, no solo reiniciar el reloj local.
    const req = httpMock.expectOne('http://localhost:8000/auth/session/continue');
    expect(req.request.method).toBe('POST');
    req.flush({ segundos_restantes: 900, ventana_segundos: 900, aviso_segundos: 60 });

    // Tras renovar, casi los 14 minutos siguientes sin actividad.
    vi.advanceTimersByTime(14 * 60 * SEGUNDO);
    expect(expirado).toBe(false);
  });

  it('reconcilia el reloj con el servidor en lugar de confiar en el local', () => {
    service.start(false);

    service.syncWithServer();
    const req = httpMock.expectOne('http://localhost:8000/auth/session');
    // El servidor dice que solo quedan 120 s. Sin reconciliar, el contador local
    // seguiría contando desde los 15 min completos y cerraría tarde.
    req.flush({ segundos_restantes: 120, ventana_segundos: 900, aviso_segundos: 60 });

    // Aun no hay aviso: el servidor da 120 s y la ventana de aviso son 60 s.
    expect(service.showWarning()).toBe(false);

    vi.advanceTimersByTime(60 * SEGUNDO);
    expect(service.showWarning()).toBe(true);
    expect(service.warningSeconds()).toBe(60);

    vi.advanceTimersByTime(60 * SEGUNDO);
    expect(expirado).toBe(true);
  });

  it('expira si el servidor reporta cero segundos restantes', () => {
    service.start(false);

    service.syncWithServer();
    httpMock
      .expectOne('http://localhost:8000/auth/session')
      .flush({ segundos_restantes: 0, ventana_segundos: 900, aviso_segundos: 60 });

    expect(expirado).toBe(true);
  });

  it('no cierra la sesión si la consulta al servidor falla por red', () => {
    service.start(false);

    service.syncWithServer();
    httpMock
      .expectOne('http://localhost:8000/auth/session')
      .flush('sin red', { status: 0, statusText: 'Error de red' });

    vi.advanceTimersByTime(5 * 60 * SEGUNDO);
    expect(expirado).toBe(false);
  });

  it('no consulta al servidor si no hay sesión iniciada', () => {
    localStorage.removeItem('access_token');
    service.start(false);

    service.syncWithServer();

    httpMock.expectNone('http://localhost:8000/auth/session');
  });

  it('detiene el aviso al cerrar la sesión', () => {
    service.start(false);
    vi.advanceTimersByTime((15 * 60 - 60) * SEGUNDO);
    expect(service.showWarning()).toBe(true);

    service.stop();

    expect(service.showWarning()).toBe(false);
    expect(service.warningSeconds()).toBeNull();
  });
});
