import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionStatusResponse } from '../models/auth.models';

/**
 * Control de inactividad con aviso y cierre automático (CU23).
 *
 * El temporizador local es una aproximación: cuando la pestaña queda suspendida
 * los navegadores recortan los `setTimeout` y el reloj se desajusta. Por eso el
 * servidor es la fuente de verdad y el cliente se reconcilia con
 * `GET /auth/session` al recuperar el foco o la visibilidad, en lugar de
 * confiar solo en el contador propio.
 *
 * Este servicio NO inyecta `AuthService`: `AuthService` ya inyecta a este, y
 * hacerlo crearía un ciclo de dependencias (NG0200). La llamada HTTP va directa
 * contra la API y el token se lee del mismo almacenamiento que usa `AuthService`.
 */
@Injectable({
  providedIn: 'root'
})
export class InactivityService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);

  private readonly activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'wheel'] as const;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private countdownId: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private timeoutMs = 0;
  /** Ventana vigente: la del servidor si se reconcilio, o la de configuracion. */
  private windowMs = 0;
  private warningMs = 0;

  private readonly listeners: Array<[Window | Document, string, EventListener]> = [];

  /** Segundos que faltan para el cierre. `null` mientras no hay aviso activo. */
  readonly warningSeconds = signal<number | null>(null);

  /** `true` cuando la sesión va a cerrarse por inactividad. */
  readonly showWarning = signal<boolean>(false);

  /** Se emite cuando la sesión expira por inactividad (CU23). */
  readonly expired$ = new Subject<void>();

  /**
   * Inicia el control de inactividad. Si `rememberMe` es true el usuario pidió
   * mantener la sesión, por lo que se usa un timeout mayor (CU23).
   */
  start(rememberMe: boolean = false): void {
    if (!isPlatformBrowser(this.platformId) || this.started) {
      return;
    }
    this.started = true;

    this.timeoutMs = (rememberMe
      ? environment.inactivityTimeoutMinutes * 2
      : environment.inactivityTimeoutMinutes) * 60 * 1000;
    this.warningMs = environment.inactivityWarningSeconds * 1000;

    this.windowMs = this.timeoutMs;
    this.setupListeners();
    this.schedule(this.windowMs);
  }

  stop(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.started = false;
    this.removeListeners();
    this.clearTimer();
    this.clearCountdown();
    this.warningSeconds.set(null);
    this.showWarning.set(false);
  }

  /**
   * El usuario elige seguir conectado tras el aviso. Se pide al servidor que
   * renueve `ultima_actividad`: reiniciar solo el temporizador local dejaria la
   * sesion cerrada por el backend en la siguiente peticion.
   */
  continueSession(): void {
    if (!this.started) {
      return;
    }
    this.restartLocalCountdown();

    const token = this.readToken();
    if (!token) {
      return;
    }
    this.http
      .post<SessionStatusResponse>(`${environment.apiUrl}/auth/session/continue`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: (status) => {
          if (!this.started || status.segundos_restantes <= 0) {
            return;
          }
          this.schedule(status.segundos_restantes * 1000);
        },
        // Si la renovacion falla (sin red) se conserva el contador local, pero
        // la proxima peticion autenticada al servidor volvera a validar la
        // inactividad, asi que no se salta ninguna comprobacion de seguridad.
        error: () => undefined
      });
  }

  private restartLocalCountdown(): void {
    this.clearCountdown();
    this.warningSeconds.set(null);
    this.showWarning.set(false);
    this.schedule(this.windowMs);
  }

  /**
   * Reconcilia el reloj local con el del servidor. Se invoca al recuperar el
   * foco, porque una pestaña suspendida deja el temporizador desfasado.
   */
  syncWithServer(): void {
    const token = this.readToken();
    if (!this.started || !token) {
      return;
    }
    this.http
      .get<SessionStatusResponse>(`${environment.apiUrl}/auth/session`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
      next: (status) => {
        if (!this.started) {
          return;
        }
        if (status.segundos_restantes <= 0) {
          this.onExpired();
          return;
        }
        const ms = status.segundos_restantes * 1000;
        this.windowMs = ms;
        this.warningMs = status.aviso_segundos * 1000;
        this.schedule(ms);
        // Si al reconciliar ya estamos dentro de la ventana de aviso, el aviso
        // debe verse de inmediato y no tras una espera completa.
        if (ms <= this.warningMs) {
          this.beginWarning(ms);
        }
      },
      // Si la consulta falla (sin red, por ejemplo) se conserva el temporizador
      // local: no debe cerrar una sesión válida por un fallo de red.
      error: () => undefined
    });
  }

  private readToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem('access_token');
  }

  private setupListeners(): void {
    const onActivity = () => {
      // Cualquier actividad real cancela un aviso ya mostrado y renueva la
      // sesion en el servidor (POST /auth/session/continue). Solo reiniciar
      // el reloj local dejaria la sesion expirada en el backend.
      if (this.showWarning()) {
        this.continueSession();
        return;
      }
      this.reset();
    };
    for (const event of this.activityEvents) {
      const target: Window | Document = window;
      target.addEventListener(event, onActivity, { passive: true });
      this.listeners.push([target, event, onActivity]);
    }

    // Reconciliación: el navegador congela los temporizadores cuando la pestaña
    // no está visible, así que al volver hay que volver a sincronizar.
    const onVisible = () => this.syncWithServer();
    document.addEventListener('visibilitychange', onVisible);
    this.listeners.push([document, 'visibilitychange', onVisible as EventListener]);
    window.addEventListener('focus', onVisible);
    this.listeners.push([window, 'focus', onVisible as EventListener]);
  }

  private removeListeners(): void {
    for (const [target, event, listener] of this.listeners) {
      target.removeEventListener(event, listener);
    }
    this.listeners.length = 0;
  }

  private schedule(ms: number): void {
    this.clearTimer();
    this.timerId = setTimeout(
      () => this.beginWarning(Math.min(ms, this.warningMs)),
      Math.max(0, ms - this.warningMs)
    );
  }

  private beginWarning(ms: number): void {
    this.clearTimer();
    let restante = Math.max(0, Math.round(ms / 1000));
    this.warningSeconds.set(restante);
    this.showWarning.set(true);

    this.countdownId = setInterval(() => {
      restante -= 1;
      this.warningSeconds.set(Math.max(0, restante));
      if (restante <= 0) {
        this.onExpired();
      }
    }, 1000);
  }

  private reset(): void {
    if (!this.started) {
      return;
    }
    this.schedule(this.windowMs);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private clearCountdown(): void {
    if (this.countdownId !== null) {
      clearInterval(this.countdownId);
      this.countdownId = null;
    }
  }

  private onExpired(): void {
    if (!this.started) {
      return;
    }
    this.stop();
    this.expired$.next();
  }
}
