import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TriageForm {
  motivo: string;
  intensidad_dolor: number;
  tiempo_evolucion: string;
  signos_alarma: string[];
  consulta_directa: string;
}

export interface TriageResponse {
  nivel: number;
  color: string;
  descripcion_nivel: string;
  tiempo_atencion_max_min: number;
  posibles_causas: string[];
  recomendaciones: string[];
  motivo_clasificacion: string;
  aviso: string;
}

@Injectable({
  providedIn: 'root'
})
export class TriageService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/triaje`;

  calcularPreliminar(data: TriageForm): Observable<TriageResponse> {
    return this.http.post<TriageResponse>(`${this.apiUrl}/preliminar`, data);
  }

  analizarIA(form: TriageForm, files: File[]): Observable<TriageResponse> {
    const formData = new FormData();
    formData.append('motivo', form.motivo);
    formData.append('intensidad_dolor', form.intensidad_dolor.toString());
    formData.append('tiempo_evolucion', form.tiempo_evolucion);
    formData.append('signos_alarma', JSON.stringify(form.signos_alarma));
    formData.append('consulta_directa', form.consulta_directa);
    
    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('evidencia', file, file.name);
      });
    }
    
    return this.http.post<TriageResponse>(`${this.apiUrl}/analizar`, formData);
  }

  derivarGuardia(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/derivar`, {});
  }
}
