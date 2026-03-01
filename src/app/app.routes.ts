import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@features/auth/login').then(m => m.LoginComponent),
  },
  {
    path: 'today',
    loadComponent: () => import('@features/entries/today').then(m => m.TodayComponent),
    canActivate: [authGuard],
  },
  {
    path: 'entries',
    loadComponent: () => import('@features/entries/entry-list').then(m => m.EntryListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'entries/:id',
    loadComponent: () => import('@features/entries/entry-detail').then(m => m.EntryDetailComponent),
    canActivate: [authGuard],
  },
];
