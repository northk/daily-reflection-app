import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@features/auth/login').then(m => m.LoginComponent),
  },
];
