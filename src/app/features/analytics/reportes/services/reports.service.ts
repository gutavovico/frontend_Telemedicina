import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ReportCatalog, ReportInterpretRequest, ReportInterpretResponse, ReportOptions, ReportQuery, ReportQueryResponse, ReportTranscriptionResponse } from '../models/report.models';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/analytics/reportes`;

  catalog(): Observable<ReportCatalog> {
    return this.http.get<ReportCatalog>(`${this.baseUrl}/catalogo`);
  }

  options(): Observable<ReportOptions> {
    return this.http.get<ReportOptions>(`${this.baseUrl}/opciones`);
  }

  query(definition: ReportQuery): Observable<ReportQueryResponse> {
    return this.http.post<ReportQueryResponse>(`${this.baseUrl}/consulta`, definition);
  }

  interpret(request: ReportInterpretRequest): Observable<ReportInterpretResponse> {
    return this.http.post<ReportInterpretResponse>(`${this.baseUrl}/interpretar`, request);
  }

  transcribe(audio: Blob, filename: string): Observable<ReportTranscriptionResponse> {
    const body = new FormData();
    body.append('audio', audio, filename);
    return this.http.post<ReportTranscriptionResponse>(`${this.baseUrl}/transcribir`, body);
  }
}
