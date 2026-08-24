import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EspecialidadResponse, MedicoResponse } from '../../../core/models/medico.models';
import { MedicoService } from '../../../core/services/medico.service';
import { AuthService } from '../../../core/services/auth.service';
import { MedicoForm } from '../medico-form/medico-form';
import { Header } from '../../../shared/components/header/header';

@Component({
  selector: 'app-medico-nuevo',
  imports: [CommonModule, RouterLink, MedicoForm, Header],
  templateUrl: './medico-nuevo.html',
  styleUrl: './medico-nuevo.css'
})
export class MedicoNuevo implements OnInit {
  private readonly medicoService = inject(MedicoService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly especialidades = signal<EspecialidadResponse[]>([]);
  readonly cargandoCatalogo = signal(true);

  /** CU04: auto-registro cuando un usuario sin perfil médico completa el suyo propio. */
  readonly esAutoRegistro = !this.authService.isAdmin();

  ngOnInit(): void {
    // Regla 1:1 solo en auto-registro: un usuario que ya tiene su perfil médico
    // no crea otro. El ADMIN registra a un doctor distinto y no debe ser redirigido,
    // aunque él mismo tenga un perfil médico.
    if (this.esAutoRegistro && this.authService.perfilMedico()) {
      this.router.navigate(['/mi-perfil-medico']);
      return;
    }

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
    // Tras crear el perfil, navega al detalle del médico
    this.router.navigate(['/medicos', medico.id_medico]);
  }
}
