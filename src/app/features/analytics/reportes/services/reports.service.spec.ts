import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { catalogFixture, optionsFixture, queryFixture, responseFixture } from '../testing/report-fixtures';
import { ReportsService } from './reports.service';

describe('CU22 cliente HTTP', () => {
  let service: ReportsService;
  let http: HttpTestingController;
  const root = `${environment.apiUrl}/analytics/reportes`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReportsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('carga catálogo y opciones de analytics', () => {
    let catalog = catalogFixture;
    let options = optionsFixture;
    service.catalog().subscribe((value) => catalog = value);
    service.options().subscribe((value) => options = value);
    const catalogRequest = http.expectOne(`${root}/catalogo`);
    const optionsRequest = http.expectOne(`${root}/opciones`);
    expect(catalogRequest.request.method).toBe('GET');
    expect(optionsRequest.request.method).toBe('GET');
    catalogRequest.flush(catalogFixture);
    optionsRequest.flush(optionsFixture);
    expect(catalog.reportes[0].id).toBe('encuentros');
    expect(options.medicos[0].id_medico).toBe(7);
  });

  it('consulta con el cuerpo contratado y conserva la respuesta normalizada', () => {
    let response = responseFixture();
    service.query(queryFixture).subscribe((value) => response = value);
    const request = http.expectOne(`${root}/consulta`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(queryFixture);
    expect(request.request.body).not.toHaveProperty('id_clinica');
    request.flush(responseFixture());
    expect(response.definicion).toEqual(queryFixture);
    expect(response.metricas['pacientes_unicos'].valor).toBe(2);
  });

  it('interpreta texto con fecha local explícita sin enviar contexto de clínica', () => {
    const payload = { texto: 'Citas de septiembre de 2026', fecha_referencia: '2026-10-03' };
    service.interpret(payload).subscribe();
    const request = http.expectOne(`${root}/interpretar`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.body).not.toHaveProperty('id_clinica');
    request.flush({ estado: 'aclaracion', definicion: null, resumen: 'Indica el año',
      campos_aclaracion: ['periodo'], advertencias: [] });
  });

  it('envía solo audio multipart al endpoint de transcripción', () => {
    const audio = new Blob(['audio sintético'], { type: 'audio/webm' });
    service.transcribe(audio, 'dictado.webm').subscribe((response) => {
      expect(response.texto).toBe('Citas de septiembre de 2026');
    });
    const request = http.expectOne(`${root}/transcribir`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    const body = request.request.body as FormData;
    expect([...body.keys()]).toEqual(['audio']);
    expect((body.get('audio') as File).name).toBe('dictado.webm');
    request.flush({ texto: 'Citas de septiembre de 2026' });
  });
});
