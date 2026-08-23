import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  let authReq = req;

  // Attach Authorization header if access token exists and not a refresh request
  if (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized, excluding auth endpoints to prevent endless loops
      if (
        error.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/register')
      ) {
        const refreshToken = authService.getRefreshToken();
        if (refreshToken) {
          return authService.refreshToken().pipe(
            switchMap((tokenResponse) => {
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${tokenResponse.access_token}`
                }
              });
              return next(retryReq);
            }),
            catchError((refreshError) => {
              authService.logout();
              return throwError(() => refreshError);
            })
          );
        } else {
          authService.logout();
        }
      }

      return throwError(() => error);
    })
  );
};
