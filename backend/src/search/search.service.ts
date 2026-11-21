import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchDto } from './zod.schema';
import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class SearchService {
  private readonly index: string;

  constructor(
    private readonly es: ElasticsearchService,
    private readonly config: ConfigService,
  ) {
    this.index = this.config.get('INDEX') ?? 'imdbmovies_alias';
  }

  async search(dto: SearchDto) {
    const { query, type = 'all', page = 1, limit = 30, genre } = dto;
    const pagination = { page, limit };

    switch (type) {
      case 'all':
        return this.searchAll(query, pagination, genre);
      case 'movie':
        return this.searchByTitle(query, pagination, genre);
      case 'director':
        return this.searchByDirector(query, pagination, genre);
      case 'actor':
        return this.searchByCast(query, pagination, genre);
      case 'keyword':
        return this.searchByKeywordOrGenre(query, pagination, genre);
    }
  }

  async movieDetails(id: string) {
    try {
      const res = await this.es.get<Record<string, unknown>>({ index: this.index, id });
      if (!res.found || !res._source) {
        throw new NotFoundException(`Movie with id ${id} not found`);
      }
      return {
        id: res._id,
        ...res._source,
      };
    } catch (error: unknown) {
      const err = error as { statusCode?: number; meta?: { statusCode?: number } };
      if (err?.statusCode === 404 || err?.meta?.statusCode === 404) {
        throw new NotFoundException(`Movie with id ${id} not found`);
      }
      throw error;
    }
  }

  private buildTitleClauses(query: string): unknown[] {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const compact = qLower.replace(/[\s\-_.,!?:']+/g, '');

    if (q.length <= 2) {
      return [
        {
          constant_score: {
            filter: {
              term: {
                'movie_title.keyword': {
                  value: qLower,
                  case_insensitive: true,
                },
              },
            },
            boost: 100,
          },
        },
        {
          constant_score: {
            filter: {
              term: {
                movie_title_normalized: {
                  value: qLower,
                  case_insensitive: true,
                },
              },
            },
            boost: 100,
          },
        },
        {
          constant_score: {
            filter: {
              prefix: {
                'movie_title.keyword': {
                  value: qLower,
                  case_insensitive: true,
                },
              },
            },
            boost: 95,
          },
        },
        {
          constant_score: {
            filter: {
              prefix: {
                movie_title_normalized: {
                  value: qLower,
                  case_insensitive: true,
                },
              },
            },
            boost: 95,
          },
        },
        {
          constant_score: {
            filter: {
              prefix: {
                movie_title_compact: {
                  value: compact,
                  case_insensitive: true,
                },
              },
            },
            boost: 90,
          },
        },
        {
          match_phrase_prefix: {
            movie_title: {
              query: q,
              boost: 85,
            },
          },
        },
      ];
    }

    const clauses: unknown[] = [
      {
        constant_score: {
          filter: {
            term: {
              'movie_title.keyword': {
                value: qLower,
                case_insensitive: true,
              },
            },
          },
          boost: 100,
        },
      },
      {
        constant_score: {
          filter: {
            term: {
              movie_title_normalized: {
                value: qLower,
                case_insensitive: true,
              },
            },
          },
          boost: 100,
        },
      },
      {
        constant_score: {
          filter: {
            term: {
              movie_title_compact: {
                value: compact,
                case_insensitive: true,
              },
            },
          },
          boost: 100,
        },
      },
      {
        match_phrase: {
          movie_title: {
            query: q,
            slop: 1,
            boost: 95,
          },
        },
      },
      {
        match_phrase_prefix: {
          movie_title: {
            query: q,
            boost: 90,
          },
        },
      },
      {
        constant_score: {
          filter: {
            prefix: {
              'movie_title.keyword': {
                value: qLower,
                case_insensitive: true,
              },
            },
          },
          boost: 90,
        },
      },
      {
        constant_score: {
          filter: {
            prefix: {
              movie_title_normalized: {
                value: qLower,
                case_insensitive: true,
              },
            },
          },
          boost: 90,
        },
      },
      {
        constant_score: {
          filter: {
            prefix: {
              movie_title_compact: {
                value: compact,
                case_insensitive: true,
              },
            },
          },
          boost: 85,
        },
      },
      {
        constant_score: {
          filter: {
            multi_match: {
              query,
              type: 'bool_prefix',
              operator: 'and',
              fields: [
                'movie_title.suggest',
                'movie_title.suggest._2gram',
                'movie_title.suggest._3gram',
              ],
            },
          },
          boost: 75,
        },
      },
      {
        match: {
          movie_title: {
            query: q,
            operator: 'and',
            boost: 60,
          },
        },
      },
      {
        match: {
          'movie_title.stemmed': {
            query: q,
            operator: 'and',
            boost: 45,
          },
        },
      },
      {
        match: {
          movie_title: {
            query: q,
            fuzziness: 'AUTO:3,6',
            operator: 'and',
            boost: 20,
          },
        },
      },
    ];
    return clauses;
  }

  private buildPersonClauses(field: string, query: string): unknown[] {
    const q = query.trim();
    const qLower = q.toLowerCase();

    if (q.length <= 2) {
      return [
        {
          constant_score: {
            filter: {
              term: {
                [`${field}.keyword`]: {
                  value: qLower,
                  case_insensitive: true,
                },
              },
            },
            boost: 65,
          },
        },
        {
          constant_score: {
            filter: {
              prefix: {
                [`${field}.keyword`]: {
                  value: qLower,
                  case_insensitive: true,
                },
              },
            },
            boost: 50,
          },
        },
      ];
    }

    return [
      {
        constant_score: {
          filter: {
            term: {
              [`${field}.keyword`]: {
                value: qLower,
                case_insensitive: true,
              },
            },
          },
          boost: 65,
        },
      },
      {
        constant_score: {
          filter: {
            prefix: {
              [`${field}.keyword`]: {
                value: qLower,
                case_insensitive: true,
              },
            },
          },
          boost: 55,
        },
      },
      {
        match: {
          [field]: {
            query: q,
            operator: 'and',
            boost: 45,
          },
        },
      },
      {
        match: {
          [field]: {
            query: q,
            fuzziness: 'AUTO:3,6',
            operator: 'and',
            boost: 20,
          },
        },
      },
    ];
  }

  private async searchAll(
    query: string,
    pagination = { page: 1, limit: 30 },
    genre?: string,
  ) {
    const q = query.trim();
    const qLower = q.toLowerCase();

    const candidates: unknown[] = [...this.buildTitleClauses(q)];

    // For short queries (<= 2 chars), user is typing a title prefix.
    // Searching cast on single characters causes massive false positives.
    // Only expand to cast, director, genres, and keywords for queries >= 3 chars.
    if (q.length >= 3) {
      candidates.push(
        ...this.buildPersonClauses('director', q),
        ...this.buildPersonClauses('cast', q),
        { constant_score: { filter: { term: { genres: qLower } }, boost: 35 } },
        { match: { keywords: { query: q, operator: 'and', boost: 30 } } },
        { match: { overview: { query: q, boost: 20 } } },
      );
    }

    return this.runSearch(candidates, q, pagination, genre);
  }

  private async searchByTitle(
    query: string,
    pagination = { page: 1, limit: 30 },
    genre?: string,
  ) {
    return this.runSearch(this.buildTitleClauses(query), query, pagination, genre);
  }

  private async searchByDirector(
    query: string,
    pagination = { page: 1, limit: 30 },
    genre?: string,
  ) {
    return this.runSearch(this.buildPersonClauses('director', query), query, pagination, genre);
  }

  private async searchByCast(
    query: string,
    pagination = { page: 1, limit: 30 },
    genre?: string,
  ) {
    return this.runSearch(this.buildPersonClauses('cast', query), query, pagination, genre);
  }

  private async searchByKeywordOrGenre(
    query: string,
    pagination = { page: 1, limit: 30 },
    genre?: string,
  ) {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const clauses: unknown[] = [
      {
        constant_score: { filter: { term: { genres: qLower } }, boost: 50 },
      },
      {
        constant_score: {
          filter: { prefix: { genres: qLower } },
          boost: 40,
        },
      },
      { match: { keywords: { query: q, operator: 'and', boost: 30 } } },
      {
        constant_score: {
          filter: { term: { 'keywords.keyword': qLower }, boost: 20 },
        },
      },
      {
        match: {
          keywords: {
            query: q,
            fuzziness: 'AUTO:3,6',
            operator: 'and',
            boost: 15,
          },
        },
      },
      {
        match: {
          overview: {
            query: q,
            boost: 15,
          },
        },
      },
    ];
    return this.runSearch(clauses, query, pagination, genre);
  }

  private async runSearch(
    queries: unknown[],
    queryText: string,
    pagination = { page: 1, limit: 30 },
    genre?: string,
  ) {
    const q = queryText.trim();
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const size = limit;

    const filterClauses: unknown[] = [];
    if (genre && genre.trim()) {
      filterClauses.push({
        term: {
          genres: genre.trim().toLowerCase(),
        },
      });
    }

    try {
      const res = await this.es.search({
        index: this.index,
        from,
        size,
        query: {
          function_score: {
            query: {
              bool: {
                must: [
                  {
                    dis_max: {
                      queries: queries as QueryDslQueryContainer[],
                      tie_breaker: 0.2,
                    },
                  },
                ],
                filter: filterClauses as QueryDslQueryContainer[],
              },
            },
            functions: [
              {
                field_value_factor: {
                  field: 'imdb_rating',
                  factor: 0.5,
                  modifier: 'none',
                  missing: 5.0,
                },
              },
              {
                field_value_factor: {
                  field: 'popularity',
                  factor: 0.1,
                  modifier: 'log1p',
                  missing: 0,
                },
              },
              {
                field_value_factor: {
                  field: 'imdb_vote_count',
                  factor: 0.0001,
                  modifier: 'log1p',
                  missing: 0,
                },
                weight: 0.3,
              },
            ],
            score_mode: 'sum',
            boost_mode: 'sum',
          },
        },
        aggs: {
          genres: {
            terms: {
              field: 'genres',
              size: 15,
            },
          },
          ratings: {
            range: {
              field: 'imdb_rating',
              ranges: [
                { from: 8.0, key: '8.0+ Highly Rated' },
                { from: 6.0, to: 8.0, key: '6.0 - 7.9 Good' },
                { to: 6.0, key: 'Below 6.0' },
              ],
            },
          },
        },
        highlight: {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          require_field_match: false,
          number_of_fragments: 0,
          fields: {
            movie_title: {
              highlight_query: {
                bool: {
                  should: [
                    { match_phrase_prefix: { movie_title: q } },
                    { match_phrase: { movie_title: { query: q, slop: 2 } } },
                    { match: { movie_title: q } },
                  ],
                },
              },
            },
            director: {
              highlight_query: {
                bool: {
                  should: [
                    { match_phrase_prefix: { director: q } },
                    { match: { director: q } },
                  ],
                },
              },
            },
            cast: {
              highlight_query: {
                bool: {
                  should: [
                    { match_phrase_prefix: { cast: q } },
                    { match: { cast: q } },
                  ],
                },
              },
            },
            genres: {},
            keywords: {},
          },
          encoder: 'html',
        },
        _source: true,
      });

      const totalHits =
        typeof res.hits.total === 'object'
          ? res.hits.total.value
          : res.hits.total ?? 0;
      const totalPages = Math.ceil(totalHits / limit);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      const result = res.hits.hits.map((hit) => ({
        id: hit._id,
        ...hit._source!,
        highlight: hit.highlight,
      }));

      const genreAggs = res.aggregations?.genres as
        | { buckets?: { key: string; doc_count: number }[] }
        | undefined;
      const ratingAggs = res.aggregations?.ratings as
        | { buckets?: { key: string; doc_count: number }[] }
        | undefined;

      return {
        result,
        pagination: {
          page,
          limit,
          total: totalHits,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        facets: {
          genres: genreAggs?.buckets ?? [],
          ratings: ratingAggs?.buckets ?? [],
        },
      };
    } catch (error: unknown) {
      console.error(
        `[SearchService] Search failed on index "${this.index}":`,
        error,
      );
      const err = error as { meta?: { body?: unknown } };
      if (err.meta?.body) {
        console.error(
          '[SearchService] Elasticsearch error details:',
          JSON.stringify(err.meta.body),
        );
      }
      return {
        result: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        facets: {
          genres: [],
          ratings: [],
        },
      };
    }
  }
}
