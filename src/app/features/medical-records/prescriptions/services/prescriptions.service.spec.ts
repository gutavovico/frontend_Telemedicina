import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { PrescriptionsService } from './prescriptions.service';

type FakeHttp = Record<'get' | 'post', ReturnType<typeof vi.fn>>;

const BASE_MED = `${environment.apiUrl}/api/v1/medicamentos`;
const BASE_REC = `${environment.apiUrl}/api/v1/recetas`;

function createHttp(): FakeHttp {
  return {
    get: vi.fn(() => of({})),
    post: vi.fn(() => of({})),
  };
}

let http: FakeHttp;
let service: PrescriptionsService;
let injector: DestroyableInjector;

function instantiate(): PrescriptionsService {
  injector = Injector.create({ providers: [{ provide: HttpClient, useValue: http }] });
  return runInInjectionContext(injector, () => new PrescriptionsService());
}

describe('PrescriptionsService (CU16)', () => {
  beforeEach(() => {
    http = createHttp();
    service = instantiate();
  });

  afterEach(() => {
    injector.destroy();
    vi.restoreAllMocks();
  });

  it('1. busca medicamentos con query, estado, skip y limit', () => {
    http.get.mockReturnValueOnce(of({ items: [], total: 0 }));
    service
      .searchMedicines({ query: '  amox  ', estado: 'ACTIVO', skip: 10, limit: 20 })
      .subscribe();
    expect(http.get).toHaveBeenCalledWith(BASE_MED, {
      params: expect.objectContaining({}),
    });
    const [, opts] = http.get.mock.calls[0] as [
      string,
      { params: { get: (k: string) => string | null } },
    ];
    expect(opts.params.get('query')).toBe('amox');
    expect(opts.params.get('estado')).toBe('ACTIVO');
    expect(opts.params.get('skip')).toBe('10');
    expect(opts.params.get('limit')).toBe('20');
  });

  it('2. crea medicamento sin tenant en el cuerpo', () => {
    http.post.mockReturnValueOnce(of({ id_medicamento: 1 }));
    const payload = {
      nombre: 'Amoxicilina',
      principio_activo: 'Amoxicilina',
      concentracion: '500 mg',
      forma_farmaceutica: 'Cápsula',
      descripcion: null,
    };
    service.createMedicine(payload).subscribe();
    expect(http.post).toHaveBeenCalledWith(BASE_MED, payload);
    const cuerpo = http.post.mock.calls[0][1] as Record<string, unknown>;
    expect('tenant_id' in cuerpo).toBe(false);
    expect('id_clinica' in cuerpo).toBe(false);
  });

  it('3. emite con Idempotency-Key y sin tenant', () => {
    const resp = new HttpResponse({ status: 201, body: { id_receta: 7 } });
    http.post.mockReturnValueOnce(of(resp));
    const payload = {
      id_consulta: 1,
      id_paciente: 2,
      fecha_vencimiento: '2026-10-01',
      indicaciones_generales: null,
      detalles: [],
    };
    service.issuePrescription(payload, 'uuid-123').subscribe();
    expect(http.post).toHaveBeenCalledWith(
      BASE_REC,
      payload,
      expect.objectContaining({ observe: 'response' }),
    );
    const [, , opts] = http.post.mock.calls[0] as [string, unknown, { headers: HttpHeaders }];
    expect(opts.headers.get('Idempotency-Key')).toBe('uuid-123');
  });

  it('4. lista recetas con skip, limit y filtros documentados', () => {
    http.get.mockReturnValueOnce(of({ items: [], total: 0 }));
    service
      .listPrescriptions({
        id_paciente: 5,
        id_medico: 3,
        estado: 'EMITIDA',
        desde: '2026-01-01',
        hasta: '2026-02-01',
        skip: 20,
        limit: 10,
      })
      .subscribe();
    const [, opts] = http.get.mock.calls[0] as [
      string,
      { params: { get: (k: string) => string | null } },
    ];
    expect(http.get.mock.calls[0][0]).toBe(BASE_REC);
    expect(opts.params.get('id_paciente')).toBe('5');
    expect(opts.params.get('id_medico')).toBe('3');
    expect(opts.params.get('estado')).toBe('EMITIDA');
    expect(opts.params.get('desde')).toBe('2026-01-01');
    expect(opts.params.get('hasta')).toBe('2026-02-01');
    expect(opts.params.get('skip')).toBe('20');
    expect(opts.params.get('limit')).toBe('10');
  });

  it('5. obtiene detalle por id', () => {
    http.get.mockReturnValueOnce(of({ id_receta: 9 }));
    service.getPrescription(9).subscribe();
    expect(http.get).toHaveBeenCalledWith(`${BASE_REC}/9`);
  });

  it('6. descarga PDF como blob con observe response', () => {
    http.get.mockReturnValueOnce(of(new HttpResponse({ status: 200, body: new Blob() })));
    service.downloadPdf(11).subscribe();
    expect(http.get).toHaveBeenCalledWith(`${BASE_REC}/11/pdf`, {
      observe: 'response',
      responseType: 'blob',
    });
  });

  it('6b. resuelve nombre desde Content-Disposition y revoca object URL', () => {
    const headers = new HttpHeaders({
      'Content-Disposition': 'attachment; filename="receta_REC-1.pdf"',
    });
    const resp = new HttpResponse({ status: 200, body: new Blob(['x']), headers });
    expect(service.resolvePdfFilename(resp, 'fallback.pdf')).toBe('receta_REC-1.pdf');

    const fallbackResp = new HttpResponse({ status: 200, body: new Blob(['x']) });
    expect(service.resolvePdfFilename(fallbackResp, 'fallback.pdf')).toBe('fallback.pdf');

    const createMock = vi.fn(() => 'blob:fake');
    const revokeMock = vi.fn();
    const appendMock = vi.fn();
    const removeMock = vi.fn();
    const clickMock = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createMock, revokeObjectURL: revokeMock });
    const anchor = { href: '', download: '', click: clickMock };
    const docMock = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: appendMock, removeChild: removeMock },
    };
    vi.stubGlobal('document', docMock);
    try {
      service.saveBlob(new Blob(['pdf']), 'receta.pdf');
      expect(createMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(revokeMock).toHaveBeenCalledWith('blob:fake');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('7. anula receta con motivo y sustituta', () => {
    http.post.mockReturnValueOnce(of({ id_receta: 4 }));
    const payload = {
      motivo_anulacion: 'Error de dosis detectado en revisión clínica',
      observaciones_anulacion: null,
      id_receta_sustituta: 5,
    };
    service.cancelPrescription(4, payload).subscribe();
    expect(http.post).toHaveBeenCalledWith(`${BASE_REC}/4/anular`, payload);
  });

  it('8. validación pública usa Cache-Control no-store y codifica el código', () => {
    http.get.mockReturnValueOnce(of({ valida: false, estado: 'NO_ENCONTRADA' }));
    service.validatePublic('  ABC 123/xyz  ').subscribe();
    expect(http.get).toHaveBeenCalledWith(
      `${BASE_REC}/validar/${encodeURIComponent('ABC 123/xyz')}`,
      expect.objectContaining({}),
    );
    const [, opts] = http.get.mock.calls[0] as [string, { headers: HttpHeaders }];
    expect(opts.headers.get('Cache-Control')).toBe('no-store');
  });
});
