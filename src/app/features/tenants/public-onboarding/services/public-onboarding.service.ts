import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  PublicPlan,
  OnboardingResponse,
  TrackingResponse,
  DeactivationRequestPayload,
  DeactivationResponse,
} from '../models/public-onboarding.model';

@Injectable({
  providedIn: 'root',
})
export class PublicOnboardingService {
  private readonly http: HttpClient;
  private readonly apiUrl = environment.apiUrl || 'http://localhost:8000';

  constructor(http?: HttpClient) {
    this.http = http ?? inject(HttpClient);
  }

  getPublicPlans(): Observable<PublicPlan[]> {
    return this.http.get<PublicPlan[]>(`${this.apiUrl}/api/v1/public/plans`);
  }

  submitOnboardingRequest(formData: FormData): Observable<OnboardingResponse> {
    return this.http.post<OnboardingResponse>(
      `${this.apiUrl}/api/v1/public/tenant-requests`,
      formData,
    );
  }

  getTrackingStatus(trackingCode: string): Observable<TrackingResponse> {
    return this.http.get<TrackingResponse>(
      `${this.apiUrl}/api/v1/public/tenant-requests/${encodeURIComponent(trackingCode.trim())}`,
    );
  }

  submitDeactivationRequest(payload: DeactivationRequestPayload): Observable<DeactivationResponse> {
    return this.http.post<DeactivationResponse>(
      `${this.apiUrl}/api/v1/tenant/deactivation-requests`,
      payload,
    );
  }
}
