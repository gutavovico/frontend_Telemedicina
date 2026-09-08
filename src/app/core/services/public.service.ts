import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClinicaRegistroRequest,
  ClinicaRegistroResponse
} from '../models/tenant.models';

@Injectable({
  providedIn: 'root'
})
export class PublicService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  registrarClinica(data: ClinicaRegistroRequest): Observable<ClinicaRegistroResponse> {
    return this.http.post<ClinicaRegistroResponse>(
      `${this.apiUrl}/api/v1/public/clinicas/registrar`,
      data
    );
  }
}
