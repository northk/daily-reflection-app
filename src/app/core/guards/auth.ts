import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth';

export const authGuard: CanActivateFn = async () => {
  const token = await inject(AuthService).getAccessToken();
  return token !== null ? true : inject(Router).createUrlTree(['/login']);
};
