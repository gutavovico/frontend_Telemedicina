import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../../core/services/patient.service';
import { Paciente } from '../../../../core/models/patient.models';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Header, Footer],
  templateUrl: './patient-list.html',
  styleUrl: './patient-list.css'
})
export class PatientList implements OnInit {
  readonly patientService = inject(PatientService);

  searchTerm = '';
  ciFilter = '';
  selectedEstado = 'ACTIVO';
  currentPage = 1;
  pageSize = 10;

  actionFeedback = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(page: number = 1): void {
    this.currentPage = page;
    this.patientService
      .getPatients(this.currentPage, this.pageSize, this.searchTerm, this.ciFilter, this.selectedEstado)
      .subscribe({
        error: (err) => {
          this.showFeedback('Error al cargar la lista de pacientes.', 'error');
        }
      });
  }

  onSearch(): void {
    this.loadPatients(1);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.ciFilter = '';
    this.selectedEstado = 'ACTIVO';
    this.loadPatients(1);
  }

  onDelete(patient: Paciente): void {
    if (confirm(`¿Está seguro de desactivar al paciente ${patient.nombres} ${patient.apellidos} (C.I. ${patient.ci})?`)) {
      this.patientService.deletePatient(patient.id_paciente).subscribe({
        next: () => {
          this.showFeedback('Paciente desactivado exitosamente.', 'success');
          this.loadPatients(this.currentPage);
        },
        error: () => {
          this.showFeedback('Error al intentar desactivar el paciente.', 'error');
        }
      });
    }
  }

  showFeedback(message: string, type: 'success' | 'error'): void {
    this.actionFeedback.set({ message, type });
    setTimeout(() => {
      this.actionFeedback.set(null);
    }, 4000);
  }

  calculateAge(birthDate: string): number {
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
