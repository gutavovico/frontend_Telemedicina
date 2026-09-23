import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas protegidas por authGuard (CU04): render del lado del cliente únicamente
  {
    path: 'medicos',
    renderMode: RenderMode.Client
  },
  {
    path: 'medicos/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'mi-perfil-medico',
    renderMode: RenderMode.Client
  },
  {
    path: 'pacientes/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'pacientes/:id/editar',
    renderMode: RenderMode.Server
  },
  {
    path: 'pacientes/:id/hce',
    renderMode: RenderMode.Server
  },
  {
    path: 'pacientes/:id/consultas/nueva',
    renderMode: RenderMode.Server
  },
  {
    path: 'appointments/agenda',
    renderMode: RenderMode.Client
  },
  {
    path: 'agenda',
    renderMode: RenderMode.Client
  },
  {
    path: 'medicos/:id/agenda',
    renderMode: RenderMode.Client
  },
  {
    path: 'appointments/consultas',
    renderMode: RenderMode.Client
  },
  {
    path: 'consultas',
    renderMode: RenderMode.Client
  },
  {
    path: 'citas',
    renderMode: RenderMode.Client
  },
  {
    path: 'fichas',
    renderMode: RenderMode.Client
  },
  {
    path: 'fichas/nueva',
    renderMode: RenderMode.Client
  },
  {
    path: 'fichas/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'documentos',
    renderMode: RenderMode.Client
  },
  {
    path: 'documentos/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'documentos/paciente/:idPaciente/documento/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'mis-documentos',
    renderMode: RenderMode.Client
  },
  {
    path: 'mis-documentos/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'bitacora',
    renderMode: RenderMode.Client
  },
  {
    path: 'audit',
    renderMode: RenderMode.Client
  },
  {
    path: 'audit-log',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
