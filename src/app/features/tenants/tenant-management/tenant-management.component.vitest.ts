import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { TenantManagementService } from './services/tenant-management.service';
import { TenantManagementComponent } from './tenant-management.component';
import {
  TenantItem,
  TenantListResponse,
  TenantRequestDetail,
  TenantRequestItem,
  TenantRequestListResponse,
} from './models/tenant-management.model';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

describe('CU30 Tenant Management Frontend', () => {
  let service: TenantManagementService;
  let mockHttp: any;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };
    service = new TenantManagementService(mockHttp);
  });

  it('lista solicitudes con filtro de estado', () => {
    const mockResponse: TenantRequestListResponse = {
      total: 1,
      page: 1,
      per_page: 20,
      items: [
        {
          id_request: 'req-1',
          institucion_nombre: 'Hospital Norte',
          nit: '12345',
          correo: 'admin@norte.com',
          responsable_nombre: 'Dra. Ana',
          responsable_correo: 'ana@norte.com',
          tracking_code: 'TRK-01',
          status: 'PENDING',
          row_version: 1,
          fecha_creacion: '2026-04-10T10:00:00Z',
        },
      ],
    };

    mockHttp.get.mockReturnValue(of(mockResponse));

    service.listTenantRequests('PENDING').subscribe((res) => {
      expect(res.total).toBe(1);
      expect(res.items[0].institucion_nombre).toBe('Hospital Norte');
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      expect.stringContaining('/tenant-requests'),
      expect.anything(),
    );
  });

  it('suspende tenant enviando motivo y row_version', () => {
    const mockTenant: TenantItem = {
      id_clinica: 1,
      nombre: 'Clínica Uno',
      estado: 'SUSPENDED',
      row_version: 2,
      fecha_creacion: '2026-04-10T10:00:00Z',
    };

    mockHttp.post.mockReturnValue(of(mockTenant));

    service
      .changeTenantStatus('1', 'suspend', { reason: 'Falta de pago', row_version: 1 })
      .subscribe((res) => {
        expect(res.estado).toBe('SUSPENDED');
      });

    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/tenants/1/suspend'),
      { reason: 'Falta de pago', row_version: 1 },
    );
  });

  it('componente inicializa y carga solicitudes y tenants', () => {
    const mockReqRes: TenantRequestListResponse = { total: 0, page: 1, per_page: 20, items: [] };
    const mockTenantRes: TenantListResponse = { total: 0, page: 1, per_page: 20, items: [] };

    mockHttp.get.mockImplementation((url: string) => {
      if (url.includes('tenant-requests')) return of(mockReqRes);
      return of(mockTenantRes);
    });

    const fb = new FormBuilder();
    const comp = new TenantManagementComponent(fb, service);
    comp.ngOnInit();

    expect(comp.loading()).toBe(false);
    expect(comp.requests().length).toBe(0);
    expect(comp.tenants().length).toBe(0);
  });

  it('componente maneja conflicto 409 al aprobar solicitud y reintenta carga', async () => {
    const req: TenantRequestItem = {
      id_request: 'req-1',
      institucion_nombre: 'Hospital Norte',
      nit: '12345',
      correo: 'admin@norte.com',
      responsable_nombre: 'Dra. Ana',
      responsable_correo: 'ana@norte.com',
      tracking_code: 'TRK-01',
      status: 'PENDING',
      row_version: 1,
      fecha_creacion: '2026-04-10T10:00:00Z',
    };

    mockHttp.post.mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: 'Versión obsoleta' } })),
    );
    mockHttp.get.mockReturnValue(of({ total: 0, page: 1, per_page: 20, items: [] }));

    const fb = new FormBuilder();
    const comp = new TenantManagementComponent(fb, service);
    await comp.aprobarSolicitud(req);

    expect(comp.errorMessage()).toContain('Conflicto');
  });
});

