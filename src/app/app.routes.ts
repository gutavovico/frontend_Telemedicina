import { Routes } from '@angular/router';
import { documentAccessGuard } from './features/medical-records/documents/guards/document-access.guard';

// Rutas de personal clinico/administrativo de CU12. El guard normaliza a
// minusculas, por lo que debe usarse el nombre del rol en la BD.
const ROLES_PERSONAL = ['admin', 'medico', 'recepcion'];
const ROLES_PACIENTE = ['paciente'];
const ROLES_MEDICO = ['medico'];

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
  // ------------------------------------------------------------------ //
  // CU12 - Documentos clínicos y exámenes
  // El orden importa: las rutas de paciente son más específicas que
  // /documentos/:id y deben declararse primero.
  // ------------------------------------------------------------------ //
  {
    path: 'documentos/paciente/:idPaciente/documento/:id',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PERSONAL },
    loadComponent: () => import('./features/medical-records/documents/components/document-detail/document-detail').then(m => m.DocumentDetail),
    title: 'Hospital San Juan de Dios - Documento del paciente'
  },
  {
    path: 'documentos/paciente/:idPaciente',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PERSONAL },
    loadComponent: () => import('./features/medical-records/documents/components/document-list/document-list').then(m => m.DocumentList),
    title: 'Hospital San Juan de Dios - Documentos del paciente'
  },
  {
    path: 'mis-documentos/:id',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PACIENTE },
    loadComponent: () => import('./features/medical-records/documents/components/document-detail/document-detail').then(m => m.DocumentDetail),
    title: 'Hospital San Juan de Dios - Mi documento'
  },
  {
    path: 'mis-documentos',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PACIENTE, modo: 'me' },
    loadComponent: () => import('./features/medical-records/documents/components/document-list/document-list').then(m => m.DocumentList),
    title: 'Hospital San Juan de Dios - Mis documentos'
  },
  {
    path: 'documentos/:id',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PERSONAL },
    loadComponent: () => import('./features/medical-records/documents/components/document-detail/document-detail').then(m => m.DocumentDetail),
    title: 'Hospital San Juan de Dios - Documento clínico'
  },
  {
    path: 'documentos',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PERSONAL },
    loadComponent: () => import('./features/medical-records/documents/components/document-list/document-list').then(m => m.DocumentList),
    title: 'Hospital San Juan de Dios - Documentos clínicos'
  },
  // ------------------------------------------------------------------ //
  // CU10 - Órdenes de Laboratorio
  // MEDICO: crear, firmar, ver propias
  // ADMIN/RECEPCION: ver todas, descargar
  // PACIENTE: ver/descargar propias (vía HCE CU12)
  // ------------------------------------------------------------------ //
  {
    path: 'ordenes-laboratorio',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_PERSONAL },
    loadComponent: () => import('./features/medical-records/laboratory-orders/components/laboratory-order-list/laboratory-order-list').then(m => m.LaboratoryOrderList),
    title: 'Hospital San Juan de Dios - Órdenes de Laboratorio'
  },
  {
    path: 'ordenes-laboratorio/nueva',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_MEDICO },
    loadComponent: () => import('./features/medical-records/laboratory-orders/components/laboratory-order-form/laboratory-order-form').then(m => m.LaboratoryOrderForm),
    title: 'Hospital San Juan de Dios - Nueva Orden de Laboratorio'
  },
  {
    path: 'ordenes-laboratorio/:id',
    canActivate: [documentAccessGuard],
    data: { roles: [...ROLES_PERSONAL, ...ROLES_PACIENTE] },
    loadComponent: () => import('./features/medical-records/laboratory-orders/components/laboratory-order-detail/laboratory-order-detail').then(m => m.LaboratoryOrderDetail),
    title: 'Hospital San Juan de Dios - Detalle Orden de Laboratorio'
  },
  {
    path: 'ordenes-laboratorio/:id/editar',
    canActivate: [documentAccessGuard],
    data: { roles: ROLES_MEDICO },
    loadComponent: () => import('./features/medical-records/laboratory-orders/components/laboratory-order-form/laboratory-order-form').then(m => m.LaboratoryOrderForm),
    title: 'Hospital San Juan de Dios - Editar Orden de Laboratorio'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
