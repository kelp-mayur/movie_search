import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from './environment';


export interface Movie {
[x: string]: any;
  id: string;
  movie_id?: number;
  movie_title?: string;
  original_title?: string;
  director?: string[];
  cast?: string[];
  genres?: string[];
  keywords?: string[] | null;
  overview?: string | null;
  imdb_rating?: number;
  imdb_vote_count?: number;
  user_rating?: number;
  user_rating_count?: number;
  popularity?: number;
  movie_title_normalized?: string;
  movie_title_compact?: string;
  highlight?: {
    movie_title?: string[];
    director?: string[];
    cast?: string[];
    genres?: string[];
    keywords?: string[];
    overview?: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1`;

  search(query: string, type = 'all'): Observable<Movie[]> {
    const params = new HttpParams().set('query', query).set('type', type);
    return this.http.get<any>(`${this.baseUrl}/movies/search`, { params }).pipe(
      map((res) => this.extractMovies(res)),
      catchError(() => of([])),
    );
  }

  getMovieDetails(id: string): Observable<Movie | undefined> {
    return this.http.get<Movie>(`${this.baseUrl}/movie/${id}`).pipe(
      catchError(() => of(undefined)),
    );
  }

  private extractMovies(res: any): Movie[] {
    if (!res) return [];
    if (Array.isArray(res.result)) return res.result as Movie[];
    if (Array.isArray(res.result?.result)) return res.result.result as Movie[];
    return [];
  }
}
