import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PatientService } from '../../../../core/services/patient.service';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, Header, Footer],
  templateUrl: './patient-detail.html',
  styleUrl: './patient-detail.css'
})
export class PatientDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly patientService = inject(PatientService);

  activeTab = signal<'general' | 'clinico' | 'emergencia'>('general');
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.patientService.getPatientById(Number(idParam)).subscribe({
        error: () => {
          this.errorMessage.set('No se pudo encontrar el expediente del paciente solicitado.');
        }
      });
    }
  }

  setTab(tab: 'general' | 'clinico' | 'emergencia'): void {
    this.activeTab.set(tab);
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
