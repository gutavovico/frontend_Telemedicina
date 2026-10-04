import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // CU12 - Documentos clínicos y exámenes.
  // Requieren sesión iniciada (documentAccessGuard) y parámetros dinámicos, por
  // lo que NO deben prerenderizarse: el build fallaría al no poder resolver
  // getPrerenderParams y, además, el HTML prerenderizado quedaría accesible sin
  // autenticación. Se renderizan solo en cliente.
  // El orden importa: ServerRoute aplica la primera coincidencia y el comodín
  // '**' de abajo capturaría estas rutas como Prerender.
  {
    path: 'documentos/paciente/:idPaciente/documento/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'documentos/paciente/:idPaciente',
    renderMode: RenderMode.Client
  },
  {
    path: 'mis-documentos/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'mis-documentos',
    renderMode: RenderMode.Client
  },
  {
    path: 'documentos/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'documentos',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
