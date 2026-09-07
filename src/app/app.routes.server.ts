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
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
