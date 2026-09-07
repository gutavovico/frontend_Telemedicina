import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
    title: 'Hospital San Juan de Dios - Telemedicina'
  },
  // =========================================================================
  // 1. MÓDULO CANÓNICO: AUTH (CU01, CU02, CU23, CU24, CU26)
  // =========================================================================
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
    title: 'Hospital San Juan de Dios - Iniciar Sesión'
  },
  {
    path: 'logout',
    loadComponent: () => import('./features/auth/logout/logout').then(m => m.Logout),
    title: 'Hospital San Juan de Dios - Cierre de Sesión'
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register),
    title: 'Hospital San Juan de Dios - Crear Cuenta'
  },
  {
    path: 'recuperar',
    loadComponent: () =>
      import('./features/auth/password-recovery/recover/recover').then(m => m.Recover),
    title: 'Hospital San Juan de Dios - Recuperar Contraseña'
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('./features/auth/password-recovery/reset-password/reset-password').then(
        m => m.ResetPassword
      ),
    title: 'Hospital San Juan de Dios - Restablecer Contraseña'
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/users-management/users-page/users-page').then(m => m.UsersPage),
    title: 'Hospital San Juan de Dios - Gestión de Usuarios'
  },
  {
    path: 'roles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/roles-permissions/roles-page/roles-page').then(m => m.RolesPage),
    title: 'Hospital San Juan de Dios - Roles y Permisos'
  },

  // =========================================================================
  // 2. MÓDULO CANÓNICO: APPOINTMENTS (CU04 - Gestión Médica y Agendas)
  // =========================================================================
  {
    path: 'medicos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medicos-list/medicos-list').then(
        m => m.MedicosList
      ),
    title: 'Hospital San Juan de Dios - Médicos'
  },
  {
    path: 'medicos/nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medico-nuevo/medico-nuevo').then(
        m => m.MedicoNuevo
      ),
    title: 'Hospital San Juan de Dios - Nuevo Perfil Médico'
  },
  {
    path: 'medicos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medico-detail/medico-detail').then(
        m => m.MedicoDetail
      ),
    title: 'Hospital San Juan de Dios - Perfil Médico'
  },
  {
    path: 'mi-perfil-medico',
    canActivate: [authGuard],
    data: { miPerfil: true },
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medico-detail/medico-detail').then(
        m => m.MedicoDetail
      ),
    title: 'Hospital San Juan de Dios - Mi Perfil Médico'
  },

  // =========================================================================
  // 3. MÓDULO CANÓNICO: MEDICAL_RECORDS (CU03 - Pacientes y Expedientes)
  // =========================================================================
  {
    path: 'pacientes',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import(
            './features/medical-records/patient-profile/patient-list/patient-list'
          ).then(m => m.PatientList),
        title: 'Hospital San Juan de Dios - Lista de Pacientes'
      },
      {
        path: 'nuevo',
        loadComponent: () =>
          import(
            './features/medical-records/patient-profile/patient-form/patient-form'
          ).then(m => m.PatientForm),
        title: 'Hospital San Juan de Dios - Nuevo Paciente'
      },
      {
        path: ':id',
        loadComponent: () =>
          import(
            './features/medical-records/patient-profile/patient-detail/patient-detail'
          ).then(m => m.PatientDetail),
        title: 'Hospital San Juan de Dios - Expediente del Paciente'
      },
      {
        path: ':id/editar',
        loadComponent: () =>
          import(
            './features/medical-records/patient-profile/patient-form/patient-form'
          ).then(m => m.PatientForm),
        title: 'Hospital San Juan de Dios - Editar Paciente'
      }
    ]
  },

  // =========================================================================
  // 4. MÓDULOS CANÓNICOS SPRINT 2, 3 Y 4 (Placeholders Inicializados)
  // =========================================================================
  {
    path: 'comunicaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/communications/communications').then(m => m.Communications),
    title: 'Hospital San Juan de Dios - Comunicaciones'
  },
  {
    path: 'analitica',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/analytics/analytics').then(m => m.Analytics),
    title: 'Hospital San Juan de Dios - Analítica'
  },
  {
    path: 'ia-asistente',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/ai-assistant/ai-assistant').then(m => m.AiAssistant),
    title: 'Hospital San Juan de Dios - Asistente IA'
  },

  // Fallback
  {
    path: '**',
    redirectTo: ''
  }
];
