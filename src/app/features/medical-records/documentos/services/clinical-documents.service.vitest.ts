import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Injector, runInInjectionContext, type DestroyableInjector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ClinicalDocumentsService } from './clinical-documents.service';
import type { DocumentoClinico, DocumentoResumen } from '../models/clinical-document.models';

type FakeHttp = Record<'get' | 'post' | 'put' | 'delete', ReturnType<typeof vi.fn>>;

const DEFAULT_BASE = `${environment.apiUrl}/api/v1/documentos`;

const RESUMEN = (id: number): DocumentoResumen =>
  ({
    id_documento: id,
    id_clinica: 1,
    tipo_documento: 'RECETA',
    titulo: `Doc ${id}`,
    fecha_documento: '2026-01-01',
    estado: 'ACTIVO',
    created_at: '2026-01-01T00:00:00Z'
  }) as DocumentoResumen;

const CLINICO = (id: number): DocumentoClinico =>
  ({
    id_documento: id,
    id_clinica: 1,
    tipo_documento: 'RECETA',
    titulo: `Doc ${id}`,
    archivo_url: '/archivos/doc.pdf',
    hash_archivo: 'abc',
    fecha_documento: '2026-01-01',
    estado: 'ACTIVO',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  }) as DocumentoClinico;

function createHttp(): FakeHttp {
  return {
    get: vi.fn(() => of({})),
    post: vi.fn(() => of({})),
    put: vi.fn(() => of({})),
    delete: vi.fn(() => of({}))
  };
}

let http: FakeHttp;
let service: ClinicalDocumentsService;
let injector: DestroyableInjector;

function instantiate(): ClinicalDocumentsService {
  injector = Injector.create({ providers: [{ provide: HttpClient, useValue: http }] });
  return runInInjectionContext(injector, () => new ClinicalDocumentsService());
}

describe('ClinicalDocumentsService (CU12)', () => {
  beforeEach(() => {
    http = createHttp();
    service = instantiate();
  });

  afterEach(() => {
    injector.destroy();
  });

  describe('getDocuments', () => {
    it('listas documentos del tenant con params por defecto (page/page_size)', () => {
      const res = {
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
        total_pages: 0
      };
      http.get.mockReturnValueOnce(of(res));
      let emitted: unknown;
      service.getDocuments().subscribe((r) => (emitted = r));

      expect(http.get).toHaveBeenCalledWith(DEFAULT_BASE, {
        params: expect.objectContaining({}) as object
      });
      expect(emitted).toEqual(res);
      expect(service.isLoading()).toBe(false);
      expect(service.totalRecords()).toBe(0);
    });

    it('en modo me usa la ruta /documentos/me', () => {
      http.get.mockReturnValueOnce(of({ items: [], total: 0, page: 1, page_size: 10, total_pages: 1 }));
      service.getDocuments('me', { tipo_documento: 'RECETA', q: '  receta  ' }).subscribe();
      const [path, opts] = http.get.mock.calls[0] as [string, { params: URLSearchParams }];
      expect(path).toBe(`${DEFAULT_BASE}/me`);
      expect(String(opts.params.getAll('tipo_documento'))).toContain('RECETA');
      expect(String(opts.params.getAll('q'))).toContain('receta');
    });

    it('usa id_paciente y fechas cuando se pasan', () => {
      http.get.mockReturnValueOnce(of({ items: [], total: 0, page: 2, page_size: 5, total_pages: 3 }));
      service
        .getDocuments('tenant', {
          page: 2,
          page_size: 5,
          id_paciente: 7,
          fecha_desde: '2026-01-01',
          fecha_hasta: '2026-02-01'
        })
        .subscribe();
      const [, opts] = http.get.mock.calls[0] as [string, { params: URLSearchParams }];
      expect(opts.params.getAll('id_paciente')).toEqual(['7']);
      expect(opts.params.getAll('fecha_desde')).toEqual(['2026-01-01']);
      expect(opts.params.getAll('fecha_hasta')).toEqual(['2026-02-01']);
      expect(service.currentPage()).toBe(2);
    });

    it('en error limpia isLoading y no rellena estado', () => {
      http.get.mockReturnValueOnce(throwError(() => new Error('boom')));
      service.getDocuments().subscribe({ error: () => undefined });
      expect(service.isLoading()).toBe(false);
      expect(service.documents()).toEqual([]);
    });
  });

  describe('getPatientDocuments', () => {
    it('llama la ruta de contrato /api/v1/pacientes/{id}/documentos', () => {
      service.getPatientDocuments(42).subscribe();
      const [path] = http.get.mock.calls[0] as [string];
      expect(path).toBe(`${environment.apiUrl}/api/v1/pacientes/42/documentos`);
    });
  });

  describe('getDocumentById', () => {
    it('llama detalle y actualiza selectedDocument', () => {
      const doc = CLINICO(9);
      http.get.mockReturnValueOnce(of(doc));
      service.getDocumentById(9).subscribe();
      expect(http.get).toHaveBeenCalledWith(`${DEFAULT_BASE}/9`);
      expect(service.selectedDocument()).toEqual(doc);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('getDownloadUrl', () => {
    it('llama el endpoint de descarga firmada', () => {
      const resp = { id_documento: 1, url_firmada: 'http://x', expira_en: 60, nombre_archivo: 'a.pdf', content_type: 'application/pdf' };
      http.get.mockReturnValueOnce(of(resp));
      service.getDownloadUrl(1).subscribe();
      expect(http.get).toHaveBeenCalledWith(`${DEFAULT_BASE}/1/download`);
    });
  });

  describe('createDocument', () => {
    it('crea, antepone a documents y limpia loading', () => {
      const nuevo = CLINICO(3);
      http.post.mockReturnValueOnce(of(nuevo));
      service.documents.set([RESUMEN(1)]);
      service
        .createDocument({ titulo: 'T', tipo_documento: 'RECETA', archivo_url: '/x', hash_archivo: 'h', fecha_documento: '2026-01-01' })
        .subscribe();
      expect(http.post).toHaveBeenCalledWith(DEFAULT_BASE, expect.objectContaining({ titulo: 'T' }));
      expect(service.documents()[0]).toEqual(nuevo);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('updateDocument', () => {
    it('actualiza el documento de la lista y del selected cuando coincide', () => {
      const upd = CLINICO(2);
      upd.titulo = 'Nuevo';
      service.documents.set([RESUMEN(2), RESUMEN(5)]);
      service.selectedDocument.set(CLINICO(2));
      http.put.mockReturnValueOnce(of(upd));
      service.updateDocument(2, { titulo: 'Nuevo' }).subscribe();
      expect(http.put).toHaveBeenCalledWith(`${DEFAULT_BASE}/2`, { titulo: 'Nuevo' });
      expect(service.documents()[0]).toEqual(upd);
      expect(service.selectedDocument()).toEqual(upd);
    });

    it('en error deja el estado previo y apaga loading', () => {
      service.documents.set([RESUMEN(2)]);
      http.put.mockReturnValueOnce(throwError(() => new Error('boom')));
      service.updateDocument(2, { titulo: 'X' }).subscribe({ error: () => undefined });
      expect(service.documents()).toHaveLength(1);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('deleteDocument', () => {
    it('borra el documento de la lista', () => {
      service.documents.set([RESUMEN(2), RESUMEN(8)]);
      http.delete.mockReturnValueOnce(of({ detail: 'anulado', id_documento: 2, estado: 'ANULADO' }));
      service.deleteDocument(2).subscribe();
      expect(http.delete).toHaveBeenCalledWith(`${DEFAULT_BASE}/2`);
      expect(service.documents().map((d) => d.id_documento)).toEqual([8]);
    });
  });

  describe('loadDocumentBlob', () => {
    it('descarga vía HttpClient para URL local', async () => {
      const blob = new Blob(['data'], { type: 'application/pdf' });
      http.get.mockReturnValueOnce(of(blob));
      const result = await service.loadDocumentBlob('/archivos/1.pdf');
      expect(http.get).toHaveBeenCalledWith(`${environment.apiUrl}/archivos/1.pdf`, {
        responseType: 'blob'
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('descarga con fetch directo para URL remota presignada', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['x'])
      });
      vi.stubGlobal('fetch', fetchMock);
      try {
        const result = await service.loadDocumentBlob('https://minio.example/bucket/x?token=1');
        expect(fetchMock).toHaveBeenCalledWith('https://minio.example/bucket/x?token=1');
        expect(result).toBeInstanceOf(Blob);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('lanza error si la URL remota falla', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
      try {
        await expect(service.loadDocumentBlob('https://minio.example/b')).rejects.toThrow(
          'No se pudo descargar el archivo (403)'
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});