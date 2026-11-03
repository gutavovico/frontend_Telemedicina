import { HttpErrorResponse, HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { BackupService } from './backup.service';
import type { BackupConfigUpdate } from '../models/backup.models';

describe('Backups: servicio web ADMIN', () => {
  let service: BackupService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/backup`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BackupService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista copias sin enviar id_clinica', () => {
    service.listar().subscribe();
    const request = http.expectOne(`${base}/listar`);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush({ data: [] });
  });

  it('genera copia como Blob descargable', () => {
    service.generar().subscribe();
    const request = http.expectOne(`${base}/generar`);
    expect(request.request.method).toBe('POST');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['sql']));
  });

  it('rechaza nombre inseguro al descargar', () => {
    const response = new HttpResponse({
      headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="../../x.txt"' }),
      body: new Blob(['sql']),
    });
    expect(service.filename(response, 'backup_seguro.sql')).toBe('backup_seguro.sql');
  });

  it('mapea 401/403/404 a mensajes claros', () => {
    const casos: [number, string][] = [
      [401, 'Tu sesión terminó. Inicia sesión nuevamente.'],
      [403, 'No tienes permiso para esta acción de respaldo.'],
      [404, 'Copia no encontrada.'],
    ];
    for (const [estado, mensaje] of casos) {
      expect(service.errorMessage(new HttpErrorResponse({ status: estado }))).toBe(mensaje);
    }
  });

  it('actualiza programación sin id_clinica en el cuerpo', () => {
    const body: BackupConfigUpdate = { hora: '02:00', dias_semana: ['lun', 'vie'], activo: true, retencion_dias: 7 };
    service.updateConfig(body).subscribe();
    const request = http.expectOne(`${base}/config`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    expect(request.request.body).not.toHaveProperty('id_clinica');
    request.flush({ ...body, ultima_ejecucion: null, ultimo_estado: null });
  });
});
