import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InactivityService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'wheel'] as const;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private timeoutMs = 0;

  private readonly listeners: Array<[Window | Document, string, EventListener]> = [];

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

    this.setupListeners();
    this.schedule(this.timeoutMs);
  }

  stop(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.started = false;
    this.removeListeners();
    this.clearTimer();
  }

  private setupListeners(): void {
    const onActivity = () => this.reset();
    for (const event of this.activityEvents) {
      const target: Window | Document = window;
      target.addEventListener(event, onActivity, { passive: true });
      this.listeners.push([target, event, onActivity]);
    }
  }

  private removeListeners(): void {
    for (const [target, event, listener] of this.listeners) {
      target.removeEventListener(event, listener);
    }
    this.listeners.length = 0;
  }

  private schedule(ms: number): void {
    this.clearTimer();
    this.timerId = setTimeout(() => this.onExpired(), ms);
  }

  private reset(): void {
    if (!this.started) {
      return;
    }
    this.schedule(this.timeoutMs);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
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