import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  CheckoutResponse,
  CheckoutStatusResponse,
  CurrentSubscription,
  PlanVersion,
  SubscriptionPaymentHistoryResponse,
} from '../models/subscription-payment.model';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionPaymentService {
  private readonly http: HttpClient;
  private readonly apiUrl: string;

  constructor(http?: HttpClient) {
    this.http = http ?? inject(HttpClient);
    this.apiUrl = environment.apiUrl;
  }

  getCurrentSubscription(): Observable<CurrentSubscription> {
    return this.http.get<CurrentSubscription>(`${this.apiUrl}/subscriptions/current`);
  }

  getActivePlans(): Observable<PlanVersion[]> {
    return this.http.get<PlanVersion[]>(`${this.apiUrl}/subscriptions/plans`);
  }

  createCheckout(planVersionId: string, cycle: 'MONTHLY' | 'ANNUAL'): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${this.apiUrl}/subscriptions/checkout`, {
      plan_version_id: planVersionId,
      cycle,
    });
  }

  getPaymentHistory(page: number = 1, perPage: number = 20): Observable<SubscriptionPaymentHistoryResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    return this.http.get<SubscriptionPaymentHistoryResponse>(
      `${this.apiUrl}/subscription-payments`,
      { params },
    );
  }

  synchronizeCheckout(idPago: string): Observable<CheckoutStatusResponse> {
    return this.http.post<CheckoutStatusResponse>(
      `${this.apiUrl}/subscriptions/checkout/${idPago}/synchronize`,
      {},
    );
  }

  downloadReceiptPdf(idPago: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/subscription-payments/${idPago}/receipt/pdf`, {
      responseType: 'blob',
    });
  }
}

