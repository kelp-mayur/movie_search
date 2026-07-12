import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService, Movie } from '../search.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results implements OnInit{
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


  ngOnInit(): void{
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const queryValue = qp.get('query') ?? '';
      const typeValue  = qp.get('type') ?? 'all';
      this.query.set(queryValue);
      this.searchMode = this.getSearchModeLabel(typeValue);
      this.results.set([]);
      this.error.set('');
      this.loading.set(false);

      if (queryValue.trim()) {
        this.fetchResults(queryValue, typeValue);
      } else {
        this.error.set('Enter at least one character to search.');
      }
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private fetchResults(query: string, type = 'all') {
    this.loading.set(true);
    this.error.set('');
    this.searchService.search(query, type).pipe(finalize(()=> this.loading.set(false))).subscribe({
      next:     (movies:Movie[]) => this.results.set(movies),
      error:    (err: HttpErrorResponse)       => this.error.set(err.message),
      complete: ()       => this.loading.set(false),
    });
  }

  navigateToMovie(movie: Movie) {
    void this.router.navigate([movie.id]);
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
