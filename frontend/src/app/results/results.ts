import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService, Movie, PaginationMeta, FacetBucket, responseSearch } from '../search.service';
import { catchError, finalize, map, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results implements OnInit, OnDestroy {
  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly searchService: SearchService, 
  ) {}

  private readonly destroy$ = new Subject<void>();
  results = signal<Movie[]>([]);
  loading = signal(false);
  error = signal('');
  query = signal('');
  searchMode = 'All fields';
  selectedGenre = signal('');
  pagination = signal<PaginationMeta | null>(null);
  genreFacets = signal<FacetBucket[]>([]);

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map((qp) => ({
          query: (qp.get('query') ?? '').trim(),
          type: qp.get('type') ?? 'all',
          page: Math.max(1, parseInt(qp.get('page') ?? '1', 10) || 1),
          genre: qp.get('genre') ?? '',
        })),
        tap(({ query, type, genre }) => {
          this.query.set(query);
          this.searchMode = this.getSearchModeLabel(type);
          this.selectedGenre.set(genre);
          this.error.set('');
          if (!query) {
            this.loading.set(false);
            this.results.set([]);
            this.pagination.set(null);
            this.error.set('Enter at least one character to search.');
          } else {
            this.loading.set(true);
          }
        }),
        switchMap(({ query, type, page, genre }) => {
          if (!query) {
            return of<responseSearch>({ result: [] });
          }
          return this.searchService.searchCatalog(query, type, page, 30, genre).pipe(
            catchError((err: HttpErrorResponse) => {
              this.error.set(err.error?.message || 'Search failed. Please try again.');
              return of<responseSearch>({ result: [] });
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        this.results.set(res.result || []);
        this.pagination.set(res.pagination || null);
        if (res.facets?.genres?.length) {
          this.genreFacets.set(res.facets.genres);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToMovie(movie: Movie) {
    void this.router.navigate([movie.id]);
  }

  goToPage(targetPage: number): void {
    if (!this.pagination() || targetPage < 1 || targetPage > this.pagination()!.totalPages) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: targetPage },
      queryParamsHandling: 'merge',
    });
  }

  toggleGenre(genreKey: string): void {
    const current = this.selectedGenre();
    const newGenre = current.toLowerCase() === genreKey.toLowerCase() ? null : genreKey;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { genre: newGenre, page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  directorNames(movie: Movie): string {
    if (!movie.director?.length) return '';
    return movie.director.join(', ');
  }

  actorNames(movie: Movie): string {
    if (!movie.cast?.length) return 'Unknown';
    return movie.cast.slice(0, 5).join(', ');
  }

  private getSearchModeLabel(typeValue: string): string {
    const map: Record<string, string> = {
      movie:    'Title',
      director: 'Director',
      actor:    'Actor / Cast',
      keyword:  'Genre / Keyword',
      all:      'All fields',
    };
    return map[typeValue] ?? 'All fields';
  }
}
