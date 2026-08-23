import { Routes } from '@angular/router';

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
    path: '**',
    redirectTo: ''
  }
];
