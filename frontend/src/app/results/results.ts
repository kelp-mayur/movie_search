import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService, Movie } from '../search.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results {
  results = signal<Movie[]>([]);
  loading = signal(false);
  error = signal('');
  query = signal('');
  searchMode = 'All fields';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly searchService: SearchService,
  ) {
    this.route.queryParamMap.subscribe((qp) => {
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

  private fetchResults(query: string, type = 'all') {
    this.loading.set(true);
    this.error.set('');
    this.searchService.search(query, type).subscribe({
      next:     (movies) => this.results.set(movies),
      error:    ()       => this.error.set('Unable to load search results.'),
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
