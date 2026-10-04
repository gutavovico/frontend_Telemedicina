// Extensión de tipos para Angular Router - Soporte para getPrerenderParams en Angular 21
import { Route as AngularRoute } from '@angular/router';

declare module '@angular/router' {
  interface Route {
    /** Función opcional para proporcionar parámetros de prerenderizado para rutas con parámetros */
    getPrerenderParams?: () => Record<string, string>[];
  }
}

// Re-exportar el tipo Route extendido
export type Route = AngularRoute;