import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TriageService, TriageResponse } from '../../../core/services/triage.service';

@Component({
  selector: 'app-triage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './triage.component.html',
  styleUrls: ['./triage.component.css']
})
export class TriageComponent {
  private triageService = inject(TriageService);
  private router = inject(Router);

  // Form state
  motivo = signal<string>('');
  intensidad_dolor = signal<number>(1);
  tiempo_evolucion = signal<string>('');
  signos_alarma = signal<string[]>([]);
  consulta_directa = signal<string>('');
  archivos = signal<File[]>([]);
  
  // UI State
  loadingPreliminar = signal(false);
  loadingIA = signal(false);
  resultado = signal<TriageResponse | null>(null);
  
  // Data
  motivos = [
    'Fiebre alta', 'Dolor agudo', 'Traumatismo / Golpe',
    'Dificultad respiratoria', 'Erupción cutánea', 'Mareo / Vértigo', 'Otro motivo'
  ];
  
  tiempos = [
    'Menos de 2 horas', 'Hoy / Pocas horas', '24 - 48 horas', 'Más de 3 días'
  ];
  
  signosList = [
    'Dificultad o mucho esfuerzo para respirar',
    'Dolor fuerte en el pecho que no se pasa',
    'Fiebre muy alta que no baja con medicamentos',
    'Sangrado abundante que no se detiene',
    'Confusión, mareos fuertes o hablar raro',
    'Debilidad, pérdida de fuerza o parálisis de repente',
    'Vómitos constantes o no poder tomar líquidos',
    'Golpe fuerte en la cabeza o pérdida de conocimiento'
  ];

  get hasGraveSigns() {
    return this.signos_alarma().length > 0;
  }

  toggleSigno(signo: string) {
    const current = this.signos_alarma();
    if (current.includes(signo)) {
      this.signos_alarma.set(current.filter(s => s !== signo));
    } else {
      this.signos_alarma.set([...current, signo]);
    }
  }

  onFileChange(event: any) {
    const files: FileList = event.target.files;
    const currentFiles = this.archivos();
    const newFiles = Array.from(files);
    
    // Check constraints: max 5 files, max 10MB each
    if (currentFiles.length + newFiles.length > 5) {
      alert('Máximo 5 archivos permitidos.');
      return;
    }
    
    for (const f of newFiles) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`El archivo ${f.name} excede los 10MB.`);
        return;
      }
    }
    
    this.archivos.set([...currentFiles, ...newFiles]);
  }

  removeFile(index: number) {
    const current = [...this.archivos()];
    current.splice(index, 1);
    this.archivos.set(current);
  }

  formatSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFormData() {
    return {
      motivo: this.motivo(),
      intensidad_dolor: this.intensidad_dolor(),
      tiempo_evolucion: this.tiempo_evolucion(),
      signos_alarma: this.signos_alarma(),
      consulta_directa: this.consulta_directa()
    };
  }

  calcularPreliminar() {
    if (!this.motivo()) return alert("Seleccione un motivo principal");
    
    this.loadingPreliminar.set(true);
    this.triageService.calcularPreliminar(this.getFormData()).subscribe({
      next: (res: TriageResponse) => {
        this.resultado.set(res);
        this.loadingPreliminar.set(false);
      },
      error: () => {
        alert('Error al calcular triaje preliminar');
        this.loadingPreliminar.set(false);
      }
    });
  }

  analizarIA() {
    if (!this.motivo()) return alert("Seleccione un motivo principal");
    if (!this.consulta_directa()) return alert("Describa sus síntomas en la consulta directa");
    
    this.loadingIA.set(true);
    this.triageService.analizarIA(this.getFormData(), this.archivos()).subscribe({
      next: (res: TriageResponse) => {
        this.resultado.set(res);
        this.loadingIA.set(false);
      },
      error: (err) => {
        alert('Error en el análisis IA: ' + (err.error?.detail || err.message));
        this.loadingIA.set(false);
      }
    });
  }

  derivarGuardia() {
    alert("Evaluación enviada al especialista de guardia exitosamente.");
    this.router.navigate(['/']); // Redirect to home or dashboard
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
