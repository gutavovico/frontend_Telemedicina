let apiUrlManual: string | null = null;

function resolverUrlApi(): string {
  if (apiUrlManual) {
    return apiUrlManual;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    const port = window.location.port;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      if (port === '4200' && window.location.origin) {
        return `${window.location.origin}/backend-api`;
      }
      const proto = window.location.protocol || 'http:';
      return `${proto}//${host}:8000`;
    }
  }
  return 'http://localhost:8000';
}

export const environment = {
  production: false,
  get apiUrl(): string {
    return resolverUrlApi();
  },
  set apiUrl(val: string) {
    apiUrlManual = val;
  },
  inactivityTimeoutMinutes: 15,
  inactivityWarningSeconds: 60
};
