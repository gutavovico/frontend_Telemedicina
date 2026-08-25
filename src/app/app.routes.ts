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
    path: '**',
    redirectTo: ''
  }
];
