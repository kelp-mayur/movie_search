import { Routes } from '@angular/router';
import { Home } from './home/home';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: Home,
  },
  {
    path: 'results',
    loadComponent: () => import('./results/results').then(mod => mod.Results)
  },
  {
    path: ':movieid',
    loadComponent: () => import('./movie-detail/movie-detail').then(mod => mod.MovieDetail),
  },
];