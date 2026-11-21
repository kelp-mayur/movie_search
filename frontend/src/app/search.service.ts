import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { environment } from './environment';


export interface Movie {
  id: string;
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


export interface FacetBucket {
  key: string;
  doc_count: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface responseSearch {
  result: Movie[];
  pagination?: PaginationMeta;
  facets?: {
    genres?: FacetBucket[];
    ratings?: FacetBucket[];
  };
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1`;

  search(query: string, type = 'all'): Observable<Movie[]> {
    const params = new HttpParams().set('query', query).set('type', type);
    return this.http.get<responseSearch>(`${this.baseUrl}/movies/search`, { params }).pipe(
      map((res: responseSearch) => this.extractMovies(res)),
      catchError((err: HttpErrorResponse) => throwError(() => err)),
    );
  }

  searchCatalog(
    query: string,
    type = 'all',
    page = 1,
    limit = 30,
    genre?: string,
  ): Observable<responseSearch> {
    let params = new HttpParams()
      .set('query', query)
      .set('type', type)
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (genre && genre.trim()) {
      params = params.set('genre', genre.trim());
    }

    return this.http.get<responseSearch>(`${this.baseUrl}/movies/search`, { params }).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => err)),
    );
  }

  getMovieDetails(id: string): Observable<Movie> {
    return this.http.get<Movie>(`${this.baseUrl}/movie/${id}`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => err)),
    );
  }

  private extractMovies(res: responseSearch): Movie[] {
    if (!res) return [];
    if (Array.isArray(res.result)) return res.result;
    return [];
  }
}
