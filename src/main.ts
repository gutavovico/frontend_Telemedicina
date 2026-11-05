import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Restaurar sesión automáticamente al pasar de http:// a https:// en el celular
if (typeof window !== 'undefined' && window.location && window.location.hash.startsWith('#sso=')) {
  try {
    const encoded = window.location.hash.substring('#sso='.length);
    const jsonStr = decodeURIComponent(escape(atob(encoded)));
    const data = JSON.parse(jsonStr);
    if (data && typeof data === 'object') {
      if (data.local) {
        Object.entries(data.local).forEach(([k, v]) => {
          if (typeof v === 'string') localStorage.setItem(k, v);
        });
      }
      if (data.session) {
        Object.entries(data.session).forEach(([k, v]) => {
          if (typeof v === 'string') sessionStorage.setItem(k, v);
        });
      }
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (e) {
    console.warn('Error al restaurar sesión SSO HTTPS:', e);
  }
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
