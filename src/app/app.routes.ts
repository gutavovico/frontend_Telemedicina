import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { panelGuard, adminOnlyGuard, staffGuard, clinicalReadGuard, clinicalWriteGuard } from './core/guards/panel-access.guard';
import { tenantGuard } from './core/guards/tenant.guard';
import { clinicaGuard } from './core/guards/clinica.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';
import { prescriptionAccessGuard } from './features/medical-records/prescriptions/guards/prescription-access.guard';
import { reportsAccessGuard } from './features/analytics/reportes/guards/reports-access.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Hospital San Juan de Dios - Telemedicina',
  },
  // =========================================================================
  // 1. MÓDULO CANÓNICO: AUTH (CU01, CU02, CU23, CU24, CU26)
  // =========================================================================
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Hospital San Juan de Dios - Iniciar Sesión',
  },
  {
    path: 'logout',
    loadComponent: () => import('./features/auth/logout/logout').then((m) => m.Logout),
    title: 'Hospital San Juan de Dios - Cierre de Sesión',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    title: 'Hospital San Juan de Dios - Crear Cuenta',
  },
  {
    path: 'recuperar',
    loadComponent: () =>
      import('./features/auth/password-recovery/recover/recover').then((m) => m.Recover),
    title: 'Hospital San Juan de Dios - Recuperar Contraseña',
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('./features/auth/password-recovery/reset-password/reset-password').then(
        (m) => m.ResetPassword,
      ),
    title: 'Hospital San Juan de Dios - Restablecer Contraseña',
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/users-management/users-page/users-page').then((m) => m.UsersPage),
    title: 'Hospital San Juan de Dios - Gestión de Usuarios',
  },
  {
    path: 'roles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/roles-permissions/roles-page/roles-page').then((m) => m.RolesPage),
    title: 'Hospital San Juan de Dios - Roles y Permisos',
  },
  {
    path: 'bitacora',
    redirectTo: '/admin/bitacora',
  },
  {
    path: 'audit',
    redirectTo: '/admin/bitacora',
  },
  {
    path: 'audit-log',
    redirectTo: '/admin/bitacora',
  },

  // =========================================================================
  // 1b. PANEL DE ADMINISTRACIÓN MULTITENANT (/admin)
  // Layout + dashboard + clínicas SaaS. Canónica de bitácora: /admin/bitacora.
  // =========================================================================
  {
    path: 'admin',
    canActivate: [authGuard, tenantGuard, clinicaGuard, panelGuard],
    loadComponent: () =>
      import('./features/admin/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/admin/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
        title: 'Hospital San Juan de Dios - Panel Administrador',
      },
      {
        path: 'clinicas',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/admin/clinicas/clinicas-list').then((m) => m.ClinicasList),
        title: 'Hospital San Juan de Dios - Gestión de Clínicas',
      },
      {
        path: 'usuarios',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/auth/users-management/users-page/users-page').then(
            (m) => m.UsersPage,
          ),
        title: 'Hospital San Juan de Dios - Gestión de Usuarios',
      },
      {
        path: 'roles',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/auth/roles-permissions/roles-page/roles-page').then(
            (m) => m.RolesPage,
          ),
        title: 'Hospital San Juan de Dios - Roles y Permisos',
      },
      {
        path: 'medicos',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/appointments/doctor-profile/medicos-list/medicos-list').then(
            (m) => m.MedicosList,
          ),
        title: 'Hospital San Juan de Dios - Directorio Médico',
      },
      {
        path: 'medicos/nuevo',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/appointments/doctor-profile/medico-nuevo/medico-nuevo').then(
            (m) => m.MedicoNuevo,
          ),
        title: 'Hospital San Juan de Dios - Nuevo Perfil Médico',
      },
      {
        path: 'medicos/:id',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/appointments/doctor-profile/medico-detail/medico-detail').then(
            (m) => m.MedicoDetail,
          ),
        title: 'Hospital San Juan de Dios - Perfil Médico',
      },
      {
        path: 'pacientes',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-list/patient-list').then(
            (m) => m.PatientList,
          ),
        title: 'Hospital San Juan de Dios - Lista de Pacientes',
      },
      {
        path: 'pacientes/nuevo',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-form/patient-form').then(
            (m) => m.PatientForm,
          ),
        title: 'Hospital San Juan de Dios - Nuevo Paciente',
      },
      {
        path: 'pacientes/:id/editar',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-form/patient-form').then(
            (m) => m.PatientForm,
          ),
        title: 'Hospital San Juan de Dios - Editar Paciente',
      },
      {
        path: 'pacientes/:id',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-detail/patient-detail').then(
            (m) => m.PatientDetail,
          ),
        title: 'Hospital San Juan de Dios - Expediente del Paciente',
      },
      {
        path: 'pacientes/:id/hce',
        canActivate: [clinicalReadGuard],
        loadComponent: () =>
          import('./features/medical-records/hce/hce-timeline/hce-timeline').then(
            (m) => m.HceTimeline,
          ),
        title: 'Hospital San Juan de Dios - Historia Clínica Electrónica',
      },
      {
        path: 'pacientes/:id/consultas/nueva',
        canActivate: [clinicalWriteGuard],
        loadComponent: () =>
          import('./features/medical-records/hce/consulta-editor/consulta-editor').then(
            (m) => m.ConsultaEditor,
          ),
        title: 'Hospital San Juan de Dios - Registrar Consulta Médica',
      },
      {
        path: 'consultas',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/appointments/consultas/consultas').then((m) => m.ConsultasComponent),
        title: 'Hospital San Juan de Dios - Consultas y Citas',
      },
      {
        path: 'inicio-medico',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/admin/medico-inicio/medico-inicio').then((m) => m.MedicoInicio),
        title: 'Hospital San Juan de Dios - Inicio Médico',
      },
      {
        path: 'agenda',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
            (m) => m.MedicalAgendaPage,
          ),
        title: 'Hospital San Juan de Dios - Agenda Médica',
      },
      {
        path: 'cola',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/appointments/live-queue/cola-operativa/cola-operativa').then(
            (m) => m.ColaOperativa,
          ),
        title: 'Hospital San Juan de Dios - Fila Virtual del Día',
      },
      {
        path: 'fichas',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/fichas/ficha-list/ficha-list').then(
            (m) => m.FichaListComponent,
          ),
        title: 'Hospital San Juan de Dios - Fichas Médicas',
      },
      {
        path: 'fichas/nueva',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/fichas/ficha-emision/ficha-emision').then(
            (m) => m.FichaEmisionComponent,
          ),
        title: 'Hospital San Juan de Dios - Emitir Ficha Médica',
      },
      {
        path: 'fichas/:id',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/medical-records/fichas/ficha-detalle/ficha-detalle').then(
            (m) => m.FichaDetalleComponent,
          ),
        title: 'Hospital San Juan de Dios - Expediente Ficha Médica',
      },
      {
        path: 'recetas/emitir',
        canActivate: [staffGuard, prescriptionAccessGuard],
        data: { roles: ['doctor'] },
        loadComponent: () =>
          import(
            './features/medical-records/prescriptions/pages/prescription-issue/prescription-issue'
          ).then((m) => m.PrescriptionIssue),
        title: 'Hospital San Juan de Dios - Emitir Receta',
      },
      {
        path: 'recetas/:id',
        canActivate: [staffGuard, prescriptionAccessGuard],
        data: { roles: ['admin', 'doctor'] },
        loadComponent: () =>
          import(
            './features/medical-records/prescriptions/pages/prescription-detail/prescription-detail'
          ).then((m) => m.PrescriptionDetail),
        title: 'Hospital San Juan de Dios - Detalle de Receta',
      },
      {
        path: 'recetas',
        canActivate: [staffGuard, prescriptionAccessGuard],
        data: { roles: ['admin', 'doctor'] },
        loadComponent: () =>
          import(
            './features/medical-records/prescriptions/pages/prescription-list/prescription-list'
          ).then((m) => m.PrescriptionList),
        title: 'Hospital San Juan de Dios - Recetas Médicas',
      },
      {
        path: 'medicamentos',
        canActivate: [adminOnlyGuard, prescriptionAccessGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/medical-records/prescriptions/pages/medicine-products/medicine-products').then(
            (m) => m.MedicineProducts,
          ),
        title: 'Hospital San Juan de Dios - Productos farmacológicos',
      },
      {
        path: 'teleconsulta',
        canActivate: [staffGuard],
        loadComponent: () =>
          import('./features/teleconsulta/teleconsulta-page').then((m) => m.TeleconsultaPage),
        title: 'Hospital San Juan de Dios - Teleconsulta y Chat',
      },
      {
        // Sin vista lista propia de HCE: se accede por paciente.
        path: 'hce',
        redirectTo: 'pacientes',
      },
      {
        path: 'documentos',
        canActivate: [staffGuard],
        loadComponent: () =>
          import(
            './features/medical-records/documentos/components/document-list/document-list'
          ).then((m) => m.DocumentList),
        title: 'Hospital San Juan de Dios - Documentos Clínicos',
      },
      {
        path: 'documentos/:id',
        canActivate: [staffGuard],
        loadComponent: () =>
          import(
            './features/medical-records/documentos/components/document-detail/document-detail'
          ).then((m) => m.DocumentDetail),
        title: 'Hospital San Juan de Dios - Detalle de Documento',
      },
      {
        path: 'bitacora',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./features/auth/audit/bitacora-page').then((m) => m.BitacoraPage),
        title: 'Hospital San Juan de Dios - Bitácora de Auditoría',
      },
    ],
  },
  {
    path: 'clinica-inactiva',
    loadComponent: () =>
      import('./features/errors/clinica-inactiva/clinica-inactiva').then(
        (m) => m.ClinicaInactiva,
      ),
    title: 'Hospital San Juan de Dios - Clínica Inactiva',
  },
  {
    path: 'sin-permisos',
    loadComponent: () =>
      import('./features/errors/sin-permisos/sin-permisos').then((m) => m.SinPermisos),
    title: 'Hospital San Juan de Dios - Acceso Denegado',
  },

  // =========================================================================
  // 2. MÓDULO CANÓNICO: APPOINTMENTS (CU04 - Gestión Médica y Agendas)
  // =========================================================================
  {
    path: 'medicos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medicos-list/medicos-list').then(
        (m) => m.MedicosList,
      ),
    title: 'Hospital San Juan de Dios - Médicos',
  },
  {
    path: 'medicos/nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medico-nuevo/medico-nuevo').then(
        (m) => m.MedicoNuevo,
      ),
    title: 'Hospital San Juan de Dios - Nuevo Perfil Médico',
  },
  {
    path: 'medicos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medico-detail/medico-detail').then(
        (m) => m.MedicoDetail,
      ),
    title: 'Hospital San Juan de Dios - Perfil Médico',
  },
  {
    path: 'mi-perfil-medico',
    canActivate: [authGuard],
    data: { miPerfil: true },
    loadComponent: () =>
      import('./features/appointments/doctor-profile/medico-detail/medico-detail').then(
        (m) => m.MedicoDetail,
      ),
    title: 'Hospital San Juan de Dios - Mi Perfil Médico',
  },
  {
    path: 'doctor-dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/doctor-profile/doctor-dashboard/doctor-dashboard').then(
        (m) => m.DoctorDashboard,
      ),
    title: 'Hospital San Juan de Dios - Panel Médico',
  },
  {
    path: 'appointments/agenda',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
        (m) => m.MedicalAgendaPage,
      ),
    title: 'Hospital San Juan de Dios - Agenda Médica',
  },
  {
    path: 'agenda',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
        (m) => m.MedicalAgendaPage,
      ),
    title: 'Hospital San Juan de Dios - Agenda Médica',
  },
  {
    path: 'medicos/:id/agenda',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/agenda/medical-agenda-page/medical-agenda-page').then(
        (m) => m.MedicalAgendaPage,
      ),
    title: 'Hospital San Juan de Dios - Agenda Médica',
  },
  {
    path: 'appointments/consultas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/consultas/consultas').then((m) => m.ConsultasComponent),
    title: 'Hospital San Juan de Dios - Consultas y Citas',
  },
  {
    path: 'consultas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/consultas/consultas').then((m) => m.ConsultasComponent),
    title: 'Hospital San Juan de Dios - Consultas y Citas',
  },
  {
    path: 'citas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/consultas/consultas').then((m) => m.ConsultasComponent),
    title: 'Hospital San Juan de Dios - Gestión de Citas',
  },
  {
    path: 'mis-citas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/mis-citas/mis-citas.component').then(
        (m) => m.MisCitasComponent
      ),
    title: 'Hospital San Juan de Dios - Mis Citas',
  },
  {
    path: 'mi-cola',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/live-queue/mi-cola/mi-cola').then((m) => m.MiCola),
    title: 'Hospital San Juan de Dios - Mi Turno en Fila',
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
          import('./features/medical-records/patient-profile/patient-list/patient-list').then(
            (m) => m.PatientList,
          ),
        title: 'Hospital San Juan de Dios - Lista de Pacientes',
      },
      {
        path: 'triage',
        loadComponent: () =>
          import('./features/medical-records/triage/triage.component').then(
            (m) => m.TriageComponent,
          ),
        title: 'Hospital San Juan de Dios - Triaje y Evaluación de Urgencias',
      },
      {
        path: 'nuevo',
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-form/patient-form').then(
            (m) => m.PatientForm,
          ),
        title: 'Hospital San Juan de Dios - Nuevo Paciente',
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-detail/patient-detail').then(
            (m) => m.PatientDetail,
          ),
        title: 'Hospital San Juan de Dios - Expediente del Paciente',
      },
      {
        path: ':id/editar',
        loadComponent: () =>
          import('./features/medical-records/patient-profile/patient-form/patient-form').then(
            (m) => m.PatientForm,
          ),
        title: 'Hospital San Juan de Dios - Editar Paciente',
      },
      {
        path: ':id/hce',
        canActivate: [clinicalReadGuard],
        loadComponent: () =>
          import('./features/medical-records/hce/hce-timeline/hce-timeline').then(
            (m) => m.HceTimeline,
          ),
        title: 'Hospital San Juan de Dios - Historia Clínica Electrónica',
      },
      {
        path: ':id/consultas/nueva',
        canActivate: [clinicalWriteGuard],
        loadComponent: () =>
          import('./features/medical-records/hce/consulta-editor/consulta-editor').then(
            (m) => m.ConsultaEditor,
          ),
        title: 'Hospital San Juan de Dios - Registrar Consulta Médica',
      },
    ],
  },
  {
    path: 'fichas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/fichas/ficha-list/ficha-list').then(
        (m) => m.FichaListComponent,
      ),
    title: 'Hospital San Juan de Dios - Fichas Médicas',
  },
  {
    path: 'fichas/nueva',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/fichas/ficha-emision/ficha-emision').then(
        (m) => m.FichaEmisionComponent,
      ),
    title: 'Hospital San Juan de Dios - Emitir Ficha Médica',
  },
  {
    path: 'fichas/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/fichas/ficha-detalle/ficha-detalle').then(
        (m) => m.FichaDetalleComponent,
      ),
    title: 'Hospital San Juan de Dios - Expediente Ficha Médica',
  },
  {
    path: 'documentos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/documentos/components/document-list/document-list').then(
        (m) => m.DocumentList,
      ),
    title: 'Hospital San Juan de Dios - Documentos Clínicos',
  },
  {
    path: 'documentos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/documentos/components/document-detail/document-detail').then(
        (m) => m.DocumentDetail,
      ),
    title: 'Hospital San Juan de Dios - Detalle de Documento',
  },
  {
    path: 'documentos/paciente/:idPaciente/documento/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/documentos/components/document-detail/document-detail').then(
        (m) => m.DocumentDetail,
      ),
    title: 'Hospital San Juan de Dios - Documento del Paciente',
  },
  {
    path: 'mis-documentos',
    canActivate: [authGuard],
    data: { modo: 'me' },
    loadComponent: () =>
      import('./features/medical-records/documentos/components/document-list/document-list').then(
        (m) => m.DocumentList,
      ),
    title: 'Hospital San Juan de Dios - Mis Documentos Clínicos',
  },
  {
    path: 'mis-documentos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/medical-records/documentos/components/document-detail/document-detail').then(
        (m) => m.DocumentDetail,
      ),
    title: 'Hospital San Juan de Dios - Mi Documento',
  },
  // CU16: orden obligatorio emitir → :id → base para que `emitir` nunca se
  // interprete como identificador. La ruta pública sigue sin `authGuard`.
  {
    path: 'medicamentos',
    canActivate: [authGuard, prescriptionAccessGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./features/medical-records/prescriptions/pages/medicine-products/medicine-products').then(
        (m) => m.MedicineProducts,
      ),
    title: 'Hospital San Juan de Dios - Productos farmacológicos',
  },
  {
    path: 'recetas/emitir',
    canActivate: [authGuard, prescriptionAccessGuard],
    data: { roles: ['doctor'] },
    loadComponent: () =>
      import('./features/medical-records/prescriptions/pages/prescription-issue/prescription-issue').then(
        (m) => m.PrescriptionIssue,
      ),
    title: 'Hospital San Juan de Dios - Emitir Receta',
  },
  {
    path: 'recetas/:id',
    canActivate: [authGuard, prescriptionAccessGuard],
    loadComponent: () =>
      import('./features/medical-records/prescriptions/pages/prescription-detail/prescription-detail').then(
        (m) => m.PrescriptionDetail,
      ),
    title: 'Hospital San Juan de Dios - Detalle de Receta',
  },
  {
    path: 'recetas',
    canActivate: [authGuard, prescriptionAccessGuard],
    loadComponent: () =>
      import('./features/medical-records/prescriptions/pages/prescription-list/prescription-list').then(
        (m) => m.PrescriptionList,
      ),
    title: 'Hospital San Juan de Dios - Recetas Médicas',
  },
  {
    path: 'validar-receta/:codigo',
    loadComponent: () =>
      import('./features/medical-records/prescriptions/pages/prescription-public-validation/prescription-public-validation').then(
        (m) => m.PrescriptionPublicValidation,
      ),
    title: 'Hospital San Juan de Dios - Validar Receta',
  },

  // =========================================================================
  // 4. MÓDULOS CANÓNICOS SPRINT 2, 3 Y 4 (Placeholders Inicializados)
  // =========================================================================
  {
    path: 'comunicaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/communications/communications').then((m) => m.Communications),
    title: 'Hospital San Juan de Dios - Comunicaciones',
  },
  {
    path: 'analitica',
    canActivate: [authGuard, reportsAccessGuard],
    loadComponent: () =>
      import('./features/analytics/reportes/pages/reports-page').then((m) => m.ReportsPage),
    title: 'Reportes clínicos y administrativos',
  },
  {
    path: 'ia-asistente',
    canActivate: [authGuard],
    loadComponent: () => import('./features/ai-assistant/ai-assistant').then((m) => m.AiAssistant),
    title: 'Hospital San Juan de Dios - Asistente IA',
  },

  // =========================================================================
  // CU15: Teleconsulta y Chat de Cita Médica
  // =========================================================================
  {
    path: 'teleconsulta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/teleconsulta/teleconsulta-page').then((m) => m.TeleconsultaPage),
    title: 'Hospital San Juan de Dios - Teleconsulta y Chat',
  },
  {
    path: 'citas/:id/teleconsulta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/teleconsulta/teleconsulta-page').then((m) => m.TeleconsultaPage),
    title: 'Hospital San Juan de Dios - Teleconsulta y Chat',
  },

  // Fallback
  {
    path: '**',
    redirectTo: '',
  },
];
