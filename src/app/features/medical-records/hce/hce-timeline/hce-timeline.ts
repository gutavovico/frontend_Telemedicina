import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HceService } from '../../../../core/services/hce.service';
import { PatientService } from '../../../../core/services/patient.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { ConsultaResponse } from '../../../../core/models/hce.models';

@Component({
  selector: 'app-hce-timeline',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Header, Footer],
  templateUrl: './hce-timeline.html',
  styleUrl: './hce-timeline.css'
})
export class HceTimeline implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly hceService = inject(HceService);
  readonly patientService = inject(PatientService);
  readonly authService = inject(AuthService);

  readonly idPaciente = signal<number>(0);
  readonly consultaExpandidaId = signal<number | null>(null);
  readonly filtroTexto = signal<string>('');

  // Consultas filtradas por texto de búsqueda (motivo, diagnóstico o síntoma)
  readonly consultasFiltradas = computed(() => {
    const historia = this.hceService.historiaActual();
    if (!historia || !historia.consultas) return [];
    const q = this.filtroTexto().toLowerCase().trim();
    if (!q) return historia.consultas;

    return historia.consultas.filter(c => {
      const enMotivo = c.motivo_consulta?.toLowerCase().includes(q);
      const enSintomas = c.sintomas?.toLowerCase().includes(q);
      const enEvolucion = c.evolucion?.toLowerCase().includes(q);
      const enDiagnosticos = c.diagnosticos?.some(
        d =>
          d.codigo_cie.toLowerCase().includes(q) ||
          d.descripcion.toLowerCase().includes(q)
      );
      return enMotivo || enSintomas || enEvolucion || enDiagnosticos;
    });
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.idPaciente.set(id);
      this.cargarDatos(id);
    }
  }

  cargarDatos(idPaciente: number): void {
    // Cargar paciente si no está en memoria
    this.patientService.getPatientById(idPaciente).subscribe();
    // Cargar historia clínica consolidada
    this.hceService.getHistoriaClinica(idPaciente).subscribe();
  }

  toggleDetalle(idConsulta: number): void {
    if (this.consultaExpandidaId() === idConsulta) {
      this.consultaExpandidaId.set(null);
    } else {
      this.consultaExpandidaId.set(idConsulta);
    }
  }

  // Helpers biométricos de visualización
  getClasePresion(sistolica?: number | null, diastolica?: number | null): string {
    if (!sistolica || !diastolica) return 'bg-gray-100 text-gray-700';
    if (sistolica >= 140 || diastolica >= 90) {
      return 'bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]';
    }
    if (sistolica >= 120 || diastolica >= 80) {
      return 'bg-amber-50 text-amber-800 border border-amber-300';
    }
    return 'bg-emerald-50 text-emerald-800 border border-emerald-300';
  }

  getClaseTemperatura(temp?: number | null): string {
    if (!temp) return 'bg-gray-100 text-gray-700';
    if (temp >= 37.5) {
      return 'bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]';
    }
    if (temp < 35.5) {
      return 'bg-cyan-50 text-cyan-800 border border-cyan-300';
    }
    return 'bg-emerald-50 text-emerald-800 border border-emerald-300';
  }

  getClaseSpo2(spo2?: number | null): string {
    if (!spo2) return 'bg-gray-100 text-gray-700';
    if (spo2 < 90) {
      return 'bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]';
    }
    if (spo2 < 95) {
      return 'bg-amber-50 text-amber-800 border border-amber-300';
    }
    return 'bg-emerald-50 text-emerald-800 border border-emerald-300';
  }

  getClaseImc(imc?: number | null): string {
    if (!imc) return 'bg-gray-100 text-gray-700';
    if (imc >= 30) return 'bg-[#ffdad6] text-[#93000a] font-semibold';
    if (imc >= 25) return 'bg-amber-50 text-amber-800 font-semibold';
    if (imc < 18.5) return 'bg-blue-50 text-blue-800 font-semibold';
    return 'bg-emerald-50 text-emerald-800 font-semibold';
  }

  getEtiquetaImc(imc?: number | null): string {
    if (!imc) return '';
    if (imc >= 30) return 'Obesidad';
    if (imc >= 25) return 'Sobrepeso';
    if (imc < 18.5) return 'Bajo peso';
    return 'Normal';
  }

  calculateAge(birthDate?: string): number {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}
