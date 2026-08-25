import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
    title: 'Hospital San Juan de Dios - Telemedicina'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
    title: 'Hospital San Juan de Dios - Iniciar Sesión'
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register),
    title: 'Hospital San Juan de Dios - Crear Cuenta'
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./features/auth/recover/recover').then(m => m.Recover),
    title: 'Hospital San Juan de Dios - Recuperar Contraseña'
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword),
    title: 'Hospital San Juan de Dios - Restablecer Contraseña'
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
