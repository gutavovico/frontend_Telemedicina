import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'appointments/agenda', renderMode: RenderMode.Client },
  // Rutas protegidas por authGuard (CU04): render del lado del cliente únicamente
  {
    path: 'medicos',
    renderMode: RenderMode.Client,
  },
  {
    path: 'medicos/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'mi-perfil-medico',
    renderMode: RenderMode.Client,
  },
  {
    path: 'pacientes/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'pacientes/:id/editar',
    renderMode: RenderMode.Server,
  },
  {
    path: 'pacientes/:id/hce',
    renderMode: RenderMode.Server,
  },
  {
    path: 'pacientes/:id/consultas/nueva',
    renderMode: RenderMode.Server,
  },
  {
    path: 'appointments/agenda',
    renderMode: RenderMode.Client,
  },
  {
    path: 'agenda',
    renderMode: RenderMode.Client,
  },
  {
    path: 'medicos/:id/agenda',
    renderMode: RenderMode.Client,
  },
  {
    path: 'appointments/consultas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'consultas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'citas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'fichas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'fichas/nueva',
    renderMode: RenderMode.Client,
  },
  {
    path: 'fichas/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'documentos',
    renderMode: RenderMode.Client,
  },
  {
    path: 'documentos/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'documentos/paciente/:idPaciente/documento/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'mis-documentos',
    renderMode: RenderMode.Client,
  },
  {
    path: 'mis-documentos/:id',
    renderMode: RenderMode.Client,
  },
  // CU16: mismo orden que app.routes.ts (emitir → :id → base).
  {
    path: 'medicamentos',
    renderMode: RenderMode.Client,
  },
  {
    path: 'recetas/emitir',
    renderMode: RenderMode.Client,
  },
  {
    path: 'recetas/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'recetas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'validar-receta/:codigo',
    renderMode: RenderMode.Server,
  },
  {
    path: 'bitacora',
    renderMode: RenderMode.Client,
  },
  {
    path: 'audit',
    renderMode: RenderMode.Client,
  },
  {
    path: 'audit-log',
    renderMode: RenderMode.Client,
  },
  // Panel de administración multitenant (/admin): solo cliente (guards + signals).
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/clinicas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/usuarios',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/roles',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/medicos',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/medicos/nuevo',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/medicos/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/pacientes',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/pacientes/nuevo',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/pacientes/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/pacientes/:id/editar',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/pacientes/:id/hce',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/pacientes/:id/consultas/nueva',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/consultas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/agenda',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/cola',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/fichas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/fichas/nueva',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/fichas/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/recetas/emitir',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/recetas/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/recetas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/teleconsulta',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/hce',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/documentos',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/documentos/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/bitacora',
    renderMode: RenderMode.Client,
  },
  {
    path: 'clinica-inactiva',
    renderMode: RenderMode.Client,
  },
  {
    path: 'sin-permisos',
    renderMode: RenderMode.Client,
  },
  // CU15: Teleconsulta y Chat de Cita Médica (rutas del cliente protegidas con sesión activa)
  {
    path: 'mis-citas',
    renderMode: RenderMode.Client,
  },
  {
    path: 'mi-cola',
    renderMode: RenderMode.Client,
  },
  {
    path: 'teleconsulta',
    renderMode: RenderMode.Client,
  },
  {
    path: 'citas/:id/teleconsulta',
    renderMode: RenderMode.Client,
  },
  {
    path: 'analitica',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

