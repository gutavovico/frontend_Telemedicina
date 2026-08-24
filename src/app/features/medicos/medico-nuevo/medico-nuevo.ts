import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EspecialidadResponse, MedicoResponse } from '../../../core/models/medico.models';
import { MedicoService } from '../../../core/services/medico.service';
import { MedicoForm } from '../medico-form/medico-form';
import { Header } from '../../../shared/components/header/header';

@Component({
  selector: 'app-medico-nuevo',
  imports: [CommonModule, RouterLink, MedicoForm, Header],
  templateUrl: './medico-nuevo.html',
  styleUrl: './medico-nuevo.css'
})
export class MedicoNuevo {
  private readonly medicoService = inject(MedicoService);
  private readonly router = inject(Router);

  readonly especialidades = signal<EspecialidadResponse[]>([]);
  readonly cargandoCatalogo = signal(true);

  constructor() {
    this.medicoService.listarEspecialidades().subscribe({
      next: (especialidades) => {
        this.especialidades.set(especialidades);
        this.cargandoCatalogo.set(false);
      },
      error: () => {
        this.cargandoCatalogo.set(false);
      }
    });
  }

  onSaved(medico: MedicoResponse): void {
    // Tras crear el perfil, navega al detalle del nuevo médico
    this.router.navigate(['/medicos', medico.id_medico]);
  }
}
