import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  CommercialAgreementUpdate,
  DeactivationListResponse,
  DeactivationRequestItem,
  TenantItem,
  TenantListResponse,
  TenantRequestDetail,
  TenantRequestListResponse,
  TenantStateAction,
} from '../models/tenant-management.model';

@Injectable({
  providedIn: 'root',
})
export class TenantManagementService {
  private readonly http: HttpClient;
  private readonly apiUrl: string;

  constructor(http?: HttpClient) {
    this.http = http ?? inject(HttpClient);
    this.apiUrl = environment.apiUrl;
  }

  listTenantRequests(
    status?: string,
    page: number = 1,
    perPage: number = 20,
  ): Observable<TenantRequestListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<TenantRequestListResponse>(`${this.apiUrl}/tenant-requests`, { params });
  }

  getTenantRequest(idRequest: string): Observable<TenantRequestDetail> {
    return this.http.get<TenantRequestDetail>(`${this.apiUrl}/tenant-requests/${idRequest}`);
  }

  approveTenantRequest(idRequest: string, rowVersion: number): Observable<TenantRequestDetail> {
    return this.http.post<TenantRequestDetail>(
      `${this.apiUrl}/tenant-requests/${idRequest}/approve`,
      { row_version: rowVersion },
    );
  }

  rejectTenantRequest(
    idRequest: string,
    reason: string,
    rowVersion: number,
  ): Observable<TenantRequestDetail> {
    return this.http.post<TenantRequestDetail>(
      `${this.apiUrl}/tenant-requests/${idRequest}/reject`,
      { reason, row_version: rowVersion },
    );
  }

  listTenants(
    status?: string,
    page: number = 1,
    perPage: number = 20,
  ): Observable<TenantListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<TenantListResponse>(`${this.apiUrl}/tenants`, { params });
  }

  getTenant(tenantId: string): Observable<TenantItem> {
    return this.http.get<TenantItem>(`${this.apiUrl}/tenants/${tenantId}`);
  }

  changeTenantStatus(
    tenantId: string,
    action: 'activate' | 'suspend' | 'reactivate' | 'deactivate',
    payload: TenantStateAction,
  ): Observable<TenantItem> {
    return this.http.post<TenantItem>(`${this.apiUrl}/tenants/${tenantId}/${action}`, payload);
  }

  updateCommercialAgreement(
    tenantId: string,
    payload: CommercialAgreementUpdate,
  ): Observable<TenantItem> {
    return this.http.put<TenantItem>(
      `${this.apiUrl}/tenants/${tenantId}/commercial-agreement`,
      payload,
    );
  }

  listDeactivationRequests(
    status?: string,
    page: number = 1,
    perPage: number = 20,
  ): Observable<DeactivationListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<DeactivationListResponse>(
      `${this.apiUrl}/tenant/deactivation-requests`,
      { params },
    );
  }

  approveDeactivationRequest(
    idDeactivation: string,
    rowVersion: number,
  ): Observable<DeactivationRequestItem> {
    return this.http.post<DeactivationRequestItem>(
      `${this.apiUrl}/tenant/deactivation-requests/${idDeactivation}/approve`,
      { row_version: rowVersion },
    );
  }

  rejectDeactivationRequest(
    idDeactivation: string,
    rowVersion: number,
    motivo: string,
  ): Observable<DeactivationRequestItem> {
    return this.http.post<DeactivationRequestItem>(
      `${this.apiUrl}/tenant/deactivation-requests/${idDeactivation}/reject`,
      { row_version: rowVersion, motivo },
    );
  }

  downloadRequestDocument(idRequest: string, docIndex: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/tenant-requests/${idRequest}/documents/${docIndex}`,
      { responseType: 'blob' },
    );
  }
}


