const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  production: !isLocalhost,
  apiUrl: isLocalhost ? 'http://localhost:8000' : 'https://telemedicina-backend-ezx9.onrender.com',
  inactivityTimeoutMinutes: 15
};

