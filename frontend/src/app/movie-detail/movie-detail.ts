import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SearchService, Movie } from '../search.service';

@Component({
  selector: 'app-movie-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './movie-detail.html',
  styleUrl: './movie-detail.css',
})
export class MovieDetail implements OnDestroy {
  movie = signal<Movie | null>(null);
  loading = signal(true);
  error = signal('');

  private destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly searchService: SearchService,
  ) {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('movieid')!;
      this.movie.set(null);
      this.error.set('');
      this.loading.set(true);

      this.searchService.getMovieDetails(id).subscribe({
        next: (movie) => {
          if (!movie) this.error.set('Movie not found.');
          else this.movie.set(movie);
        },
        error: () => this.error.set('Unable to load movie details.'),
        complete: () => this.loading.set(false),
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  directorNames(movie: Movie): string {
    return movie.director?.join(', ') ?? 'N/A';
  }

  actorNames(movie: Movie): string {
    return movie.cast?.join(', ') ?? 'Unknown';
  }
}
