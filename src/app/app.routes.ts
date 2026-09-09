import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'appointments/agenda',
    canActivate: [authGuard],
    loadComponent: () => import('./features/appointments/medical-agenda-page/medical-agenda-page').then(m => m.MedicalAgendaPage),
    title: 'Hospital San Juan de Dios - Agenda médica'
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
    title: 'Hospital San Juan de Dios - Telemedicina'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
    title: 'Hospital San Juan de Dios - Iniciar Sesion'
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register),
    title: 'Hospital San Juan de Dios - Crear Cuenta'
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./features/auth/recover/recover').then(m => m.Recover),
    title: 'Hospital San Juan de Dios - Recuperar Contrasena'
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword),
    title: 'Hospital San Juan de Dios - Restablecer Contrasena'
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () => import('./features/users/users-page/users-page').then(m => m.UsersPage),
    title: 'Hospital San Juan de Dios - Gestion de Usuarios'
  },
  {
    path: 'roles',
    canActivate: [authGuard],
    loadComponent: () => import('./features/roles/roles-page/roles-page').then(m => m.RolesPage),
    title: 'Hospital San Juan de Dios - Roles y Permisos'
  },
  {
    path: 'medicos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/medicos/medicos-list/medicos-list').then(m => m.MedicosList),
    title: 'Hospital San Juan de Dios - Médicos'
  },
  {
    path: 'medicos/nuevo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/medicos/medico-nuevo/medico-nuevo').then(m => m.MedicoNuevo),
    title: 'Hospital San Juan de Dios - Nuevo Perfil Médico'
  },
  {
    path: 'medicos/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/medicos/medico-detail/medico-detail').then(m => m.MedicoDetail),
    title: 'Hospital San Juan de Dios - Perfil Médico'
  },
  {
    path: 'mi-perfil-medico',
    canActivate: [authGuard],
    data: { miPerfil: true },
    loadComponent: () => import('./features/medicos/medico-detail/medico-detail').then(m => m.MedicoDetail),
    title: 'Hospital San Juan de Dios - Mi Perfil Médico'
  },
  {
    path: 'pacientes',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/medical-records/patients/patient-list/patient-list').then(
            m => m.PatientList
          ),
        title: 'Hospital San Juan de Dios - Lista de Pacientes'
      },
      {
        path: 'nuevo',
        loadComponent: () =>
          import('./features/medical-records/patients/patient-form/patient-form').then(
            m => m.PatientForm
          ),
        title: 'Hospital San Juan de Dios - Nuevo Paciente'
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/medical-records/patients/patient-detail/patient-detail').then(
            m => m.PatientDetail
          ),
        title: 'Hospital San Juan de Dios - Expediente del Paciente'
      },
      {
        path: ':id/editar',
        loadComponent: () =>
          import('./features/medical-records/patients/patient-form/patient-form').then(
            m => m.PatientForm
          ),
        title: 'Hospital San Juan de Dios - Editar Paciente'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
