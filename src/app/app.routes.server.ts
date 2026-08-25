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
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
