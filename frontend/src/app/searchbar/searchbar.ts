import { Component, OnDestroy, inject, Input, OnInit, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap, takeUntil } from 'rxjs';
import { SearchService, Movie } from '../search.service';

@Component({
  selector: 'app-searchbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './searchbar.html',
  styleUrl: './searchbar.css',
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class Searchbar implements OnInit, OnDestroy {
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  private readonly destroy$ = new Subject<void>();
  private readonly searchTerm$ = new Subject<string>();
  
  searchQuery = '';
  searchType = 'all';
  results = signal<Movie[]>([]);
  loading = signal(false);
  error = signal('');
  showDropdown = signal(false);

  private setupSearchStream(): void {
    this.searchTerm$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = query.trim();
        
        if (!trimmed) {
          this.resetResults();
          return of([]);
        }

        this.loading.set(true);
        this.showDropdown.set(true);
        this.error.set('');
        
        return this.searchService.search(trimmed, this.searchType).pipe(
          catchError(() => {
            this.error.set('Search failed.');
            return of([]);
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((items) => {
      console.log(items)
      this.results.set(items);
      this.loading.set(false);
      this.showDropdown.set(items.length > 0);
    });
  }

  ngOnInit(): void {
    this.setupSearchStream();
  }

  onInput(): void {
    const trimmed = this.searchQuery?.trim() ?? '';
    if (!trimmed) {
      this.resetResults();
      this.searchTerm$.next('');
      return;
    }
    this.error.set('');
    this.searchTerm$.next(this.searchQuery);
  }
  onFocus(): void {
    if (this.results().length > 0) {
      this.showDropdown.set(true);
    }
  }
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown.set(false);
    }
  }
  search(): void {
    const query = this.searchQuery.trim();
    if (!query) {
      this.resetResults();
      return;
    }
    this.error.set('');
    this.showDropdown.set(false);
    // console.log(this.searchType);
    this.router.navigate(['/results'], {
      queryParams: { query, type: this.searchType },
    });
  }
  selectMovie(movie: Movie): void {
    const identifier = movie.id;
    this.showDropdown.set(false);
    this.resetResults();
    this.router.navigate([`/${identifier}`]);
  }
  setSearchType(value: string): void {
    this.searchType = value;
    this.resetResults();
    if (this.searchQuery.trim()) {
      this.searchTerm$.next(this.searchQuery);
    }
  }

  private resetResults(): void {
    this.results.set([]);
    this.showDropdown.set(false);
    this.loading.set(false);
    this.error.set('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

getDisplayTitle(movie: Movie): string {
  if (movie.highlight?.movie_title && movie.highlight.movie_title[0]) {
    return movie.highlight.movie_title[0];  
  }
  return movie.movie_title || 'Untitled';
}

getAdditionalHighlights(movie: Movie): { type: string; html: string }[] {
  const highlights: { type: string; html: string }[] = [];

  if (!movie.highlight) return highlights;

  if (movie.highlight.director?.[0]) {
    highlights.push({ type: 'Director', html: movie.highlight.director[0] });
  }
  if (movie.highlight.cast?.[0]) {
    highlights.push({ type: 'Actor', html: movie.highlight.cast[0] });
  }
  if (movie.highlight.genres?.[0]) {
    highlights.push({ type: 'Genre', html: movie.highlight.genres[0] });
  }
  if (movie.highlight.keywords?.[0]) {
    highlights.push({ type: 'Keyword', html: movie.highlight.keywords[0] });
  }

  return highlights;
}
}