import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { clinicaGuard } from './core/guards/clinica.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
    title: 'Hospital San Juan de Dios - Telemedicina'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
    title: 'Telemedicina - Iniciar Sesión'
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register),
    title: 'Telemedicina - Crear Cuenta'
  },
  {
    path: 'registro-clinica',
    loadComponent: () => import('./features/public/registro-clinica/registro-clinica').then(m => m.RegistroClinica),
    title: 'Telemedicina - Registro de Clínica'
  },
  {
    path: 'clinica-inactiva',
    loadComponent: () => import('./features/errors/clinica-inactiva/clinica-inactiva').then(m => m.ClinicaInactiva),
    title: 'Telemedicina - Clínica Inactiva'
  },
  {
    path: 'sin-permisos',
    loadComponent: () => import('./features/errors/sin-permisos/sin-permisos').then(m => m.SinPermisos),
    title: 'Telemedicina - Acceso Denegado'
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./features/auth/recover/recover').then(m => m.Recover),
    title: 'Telemedicina - Recuperar Contraseña'
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword),
    title: 'Telemedicina - Restablecer Contraseña'
  },
  // Panel de Administrador
  {
    path: 'admin',
    canActivate: [authGuard, tenantGuard, clinicaGuard, adminGuard],
    loadComponent: () => import('./features/admin/admin-layout/admin-layout').then(m => m.AdminLayout),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard),
        title: 'Telemedicina - Panel Administrador'
      },
      {
        path: 'clinicas',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./features/admin/clinicas/clinicas-list').then(m => m.ClinicasList),
        title: 'Telemedicina - Gestión de Clínicas'
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/users/users-page/users-page').then(m => m.UsersPage),
        title: 'Telemedicina - Gestión de Usuarios'
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/roles/roles-page/roles-page').then(m => m.RolesPage),
        title: 'Telemedicina - Roles y Permisos'
      },
      {
        path: 'medicos',
        loadComponent: () => import('./features/medicos/medicos-list/medicos-list').then(m => m.MedicosList),
        title: 'Telemedicina - Directorio Médico'
      },
      {
        path: 'medicos/nuevo',
        loadComponent: () => import('./features/medicos/medico-nuevo/medico-nuevo').then(m => m.MedicoNuevo),
        title: 'Telemedicina - Nuevo Perfil Médico'
      },
      {
        path: 'medicos/:id',
        loadComponent: () => import('./features/medicos/medico-detail/medico-detail').then(m => m.MedicoDetail),
        title: 'Telemedicina - Perfil Médico'
      },
      {
        path: 'bitacora',
        loadComponent: () => import('./features/admin/bitacora/bitacora-page').then(m => m.BitacoraPage),
        title: 'Telemedicina - Bitácora de Auditoría'
      }
    ]
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, tenantGuard, clinicaGuard],
    loadComponent: () => import('./features/users/users-page/users-page').then(m => m.UsersPage),
    title: 'Telemedicina - Gestión de Usuarios'
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
