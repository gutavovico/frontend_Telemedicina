import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HceService } from './hce.service';
import { environment } from '../../../environments/environment';

describe('HceService: errores 404', () => {
  let service: HceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('distingue una ruta ausente en el servidor de un paciente ajeno', () => {
    service.getHistoriaClinica(4).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/api/v1/hce/pacientes/4`).flush(
      { detail: 'Not Found' }, { status: 404, statusText: 'Not Found' },
    );
    expect(service.errorMessage()).toContain('no ofrece la ruta de historia clínica');
    expect(service.historiaActual()).toBeNull();
  });

  it('conserva el mensaje de aislamiento si el endpoint existe', () => {
    service.getHistoriaClinica(4).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/api/v1/hce/pacientes/4`).flush(
      { detail: 'Paciente no encontrado en este centro médico' },
      { status: 404, statusText: 'Not Found' },
    );
    expect(service.errorMessage()).toContain('no pertenece a su centro médico');
  });
});
