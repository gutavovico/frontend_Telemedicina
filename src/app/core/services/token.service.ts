import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface DecodedToken {
  sub: string;
  tenant_id: number | null;
  email?: string;
  token_version?: number;
  type?: string;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setToken(token: string): void {
    if (this.isBrowser && token) {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
    }
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (this.isBrowser && token) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
    }
  }

  clearTokens(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    }
  }

  decodeToken(): DecodedToken | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const raw = JSON.parse(jsonPayload);

      let tenantIdNum: number | null = null;
      if (raw.tenant_id !== undefined && raw.tenant_id !== null && raw.tenant_id !== '') {
        const parsed = parseInt(String(raw.tenant_id), 10);
        tenantIdNum = isNaN(parsed) ? null : parsed;
      }

      return {
        sub: String(raw.sub ?? ''),
        tenant_id: tenantIdNum,
        email: raw.email,
        token_version: raw.token_version,
        type: raw.type,
        exp: raw.exp,
      };
    } catch {
      return null;
    }
  }

  isExpired(): boolean {
    const decoded = this.decodeToken();
    if (!decoded || !decoded.exp) return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return decoded.exp <= nowInSeconds;
  }

  isAboutToExpire(thresholdMinutes = 5): boolean {
    const decoded = this.decodeToken();
    if (!decoded || !decoded.exp) return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return decoded.exp - nowInSeconds <= thresholdMinutes * 60;
  }
}
