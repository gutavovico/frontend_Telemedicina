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
  {
    path: 'bitacora',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/audit/bitacora-page').then(m => m.BitacoraPage),
    title: 'Hospital San Juan de Dios - Bitácora de Auditoría'
  },
  {
    path: 'audit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/audit/bitacora-page').then(m => m.BitacoraPage),
    title: 'Hospital San Juan de Dios - Bitácora de Auditoría'
  },
  {
    path: 'audit-log',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/audit/bitacora-page').then(m => m.BitacoraPage),
    title: 'Hospital San Juan de Dios - Bitácora de Auditoría'
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
  {
    path: 'doctor-dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/appointments/doctor-profile/doctor-dashboard/doctor-dashboard'
      ).then(m => m.DoctorDashboard),
    title: 'Hospital San Juan de Dios - Panel Médico'
  },
  {
    path: 'appointments/agenda',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
        m => m.MedicalAgendaPage
      ),
    title: 'Hospital San Juan de Dios - Agenda Médica'
  },
  {
    path: 'agenda',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
        m => m.MedicalAgendaPage
      ),
    title: 'Hospital San Juan de Dios - Agenda Médica'
  },
  {
    path: 'medicos/:id/agenda',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
        m => m.MedicalAgendaPage
      ),
    title: 'Hospital San Juan de Dios - Agenda Médica'
  },
  {
    path: 'appointments/consultas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/consultas/consultas').then(
        m => m.ConsultasComponent
      ),
    title: 'Hospital San Juan de Dios - Consultas y Citas'
  },
  {
    path: 'consultas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/consultas/consultas').then(
        m => m.ConsultasComponent
      ),
    title: 'Hospital San Juan de Dios - Consultas y Citas'
  },
  {
    path: 'citas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/consultas/consultas').then(
        m => m.ConsultasComponent
      ),
    title: 'Hospital San Juan de Dios - Gestión de Citas'
  },

  // =========================================================================
  // 3. MÓDULO CANÓNICO: MEDICAL_RECORDS (CU03 - Pacientes y Expedientes, CU28 - HCE)
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
      },
      {
        path: ':id/hce',
        loadComponent: () =>
          import('./features/medical-records/hce/hce-timeline/hce-timeline').then(
            m => m.HceTimeline
          ),
        title: 'Hospital San Juan de Dios - Historia Clínica Electrónica'
      },
      {
        path: ':id/consultas/nueva',
        loadComponent: () =>
          import(
            './features/medical-records/hce/consulta-editor/consulta-editor'
          ).then(m => m.ConsultaEditor),
        title: 'Hospital San Juan de Dios - Registrar Consulta Médica'
      }
    ]
  },
  {
    path: 'fichas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/fichas/ficha-list/ficha-list').then(m => m.FichaListComponent),
    title: 'Hospital San Juan de Dios - Fichas Médicas'
  },
  {
    path: 'fichas/nueva',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/fichas/ficha-emision/ficha-emision').then(m => m.FichaEmisionComponent),
    title: 'Hospital San Juan de Dios - Emitir Ficha Médica'
  },
  {
    path: 'fichas/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/fichas/ficha-detalle/ficha-detalle').then(m => m.FichaDetalleComponent),
    title: 'Hospital San Juan de Dios - Expediente Ficha Médica'
  },
  {
    path: 'documentos',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/medical-records/documentos/components/document-list/document-list'
      ).then(m => m.DocumentList),
    title: 'Hospital San Juan de Dios - Documentos Clínicos'
  },
  {
    path: 'documentos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/medical-records/documentos/components/document-detail/document-detail'
      ).then(m => m.DocumentDetail),
    title: 'Hospital San Juan de Dios - Detalle de Documento'
  },
  {
    path: 'documentos/paciente/:idPaciente/documento/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/medical-records/documentos/components/document-detail/document-detail'
      ).then(m => m.DocumentDetail),
    title: 'Hospital San Juan de Dios - Documento del Paciente'
  },
  {
    path: 'mis-documentos',
    canActivate: [authGuard],
    data: { modo: 'me' },
    loadComponent: () =>
      import(
        './features/medical-records/documentos/components/document-list/document-list'
      ).then(m => m.DocumentList),
    title: 'Hospital San Juan de Dios - Mis Documentos Clínicos'
  },
  {
    path: 'mis-documentos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/medical-records/documentos/components/document-detail/document-detail'
      ).then(m => m.DocumentDetail),
    title: 'Hospital San Juan de Dios - Mi Documento'
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
