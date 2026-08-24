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
    path: '**',
    redirectTo: ''
  }
];
