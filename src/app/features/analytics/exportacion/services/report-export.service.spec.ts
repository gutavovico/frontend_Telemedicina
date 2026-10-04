import { HttpErrorResponse, HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { queryFixture } from '../../reportes/testing/report-fixtures';
import { ReportFormat } from '../../reportes/models/report.models';
import { ReportExportService } from './report-export.service';

describe('CU27 exportación de reportes', () => {
  let service: ReportExportService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/analytics/reportes/exportar`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReportExportService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['pdf', 'xlsx', 'csv', 'html'] as ReportFormat[])(
    'envía la definición normalizada y recibe %s como Blob', (format) => {
      let response: HttpResponse<Blob> | undefined;
      service.export(queryFixture, format).subscribe((value) => response = value);
      const request = http.expectOne(url);
      expect(request.request.method).toBe('POST');
      expect(request.request.responseType).toBe('blob');
      expect(request.request.body).toEqual({ ...queryFixture, formato: format });
      expect(request.request.body).not.toHaveProperty('id_clinica');
      request.flush(new Blob(['test']), { headers: { 'Content-Disposition': `attachment; filename="informe.${format}"` } });
      expect(response?.body).toBeInstanceOf(Blob);
      expect(service.filename(response!, queryFixture, format)).toBe(`informe.${format}`);
    },
  );

  it('rechaza nombre inseguro y extensión incorrecta', () => {
    const response = new HttpResponse({ headers: new HttpHeaders({
      'Content-Disposition': 'attachment; filename="../../datos.xlsx"',
    }), body: new Blob(['test']) });
    expect(service.filename(response, queryFixture, 'csv')).toMatch(/^reporte_encuentros_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(service.filename(response, queryFixture, 'xlsx')).toBe('datos.xlsx');
  });

  it('descarga en la misma página y libera la URL temporal después', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:report-test');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const response = new HttpResponse({ body: new Blob(['a,b'], { type: 'text/csv' }) });
    service.download(response, 'reporte.csv', 'csv');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'text/csv; charset=utf-8' }));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="reporte.csv"]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(revoke).toHaveBeenCalledWith('blob:report-test');
  });

  it('decodifica un error JSON dentro de Blob y explica 413', async () => {
    expect(await service.errorMessage(new HttpErrorResponse({ status: 422,
      error: new Blob([JSON.stringify({ detail: 'Filtro inválido' })], { type: 'application/json' }),
    }))).toBe('Filtro inválido');
    expect(await service.errorMessage(new HttpErrorResponse({ status: 413,
      error: new Blob([JSON.stringify({ detail: 'too many rows' })]),
    }))).toContain('Reduce el período');
  });
});
