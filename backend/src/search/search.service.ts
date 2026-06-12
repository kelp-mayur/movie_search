/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchDto } from './zod.schema';

@Injectable()
export class SearchService {
  private readonly index: string;

  constructor(
    private readonly es: ElasticsearchService,
    private readonly config: ConfigService,
  ) {
    this.index = this.config.get('INDEX') ?? 'movies8';
  }

  async search(dto: SearchDto) {
    const { query, type = 'all' } = dto;
    switch (type) {
      case 'all':
        return this.searchAll(query);
      case 'movie':
        return this.searchByTitle(query);
      case 'director':
        return this.searchByDirector(query);
      case 'actor':
        return this.searchByCast(query);
      case 'keyword':
        return this.searchByKeywordOrGenre(query);
      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  async movieDetails(id: string) {
    const res = await this.es.search({
      index: this.index,
      query: { term: { _id: id } },
      size: 1,
    });
    const hit = res.hits.hits[0];
    return hit ? hit._source : null;
  }

  private buildTitleClauses(query: string): unknown[] {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const compact = qLower.replace(/[\s\-_.,!?:']+/g, '');

    if (q.length <= 2) {
      return [
        {
          constant_score: {
            filter: { term: { 'movie_title.keyword': qLower } },
            boost: 100,
          },
        },
        {
          constant_score: {
            filter: { term: { movie_title_normalized: qLower } },
            boost: 100,
          },
        },
        {
          constant_score: {
            filter: { prefix: { 'movie_title.keyword': qLower } },
            boost: 90,
          },
        },
        {
          constant_score: {
            filter: { prefix: { movie_title_normalized: qLower } },
            boost: 90,
          },
        },
      ];
    }

    const clauses: unknown[] = [
      {
        constant_score: {
          filter: { term: { 'movie_title.keyword': qLower } },
          boost: 100,
        },
      },
      {
        constant_score: {
          filter: { term: { movie_title_normalized: qLower } },
          boost: 100,
        },
      },
      {
        constant_score: {
          filter: { term: { movie_title_compact: compact } },
          boost: 100,
        },
      },
      {
        constant_score: {
          filter: { prefix: { 'movie_title.keyword': qLower } },
          boost: 90,
        },
      },
      {
        constant_score: {
          filter: { prefix: { movie_title_normalized: qLower } },
          boost: 90,
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
        },
      },
      // {
      //   constant_score: {
      //     filter: {
      //       match: { 'movie_title.prefix': { query: q, operator: 'and' } },
      //     },
      //   },
      // },
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
            filter: { term: { [`${field}.keyword`]: qLower } },
            boost: 70,
          },
        },
        {
          constant_score: {
            filter: { prefix: { [`${field}.keyword`]: qLower } },
            boost: 50,
          },
        },
      ];
    }

    return [
      {
        constant_score: {
          filter: { term: { [`${field}.keyword`]: qLower } },
          boost: 60,
        },
      },
      {
        constant_score: {
          filter: { prefix: { [`${field}.keyword`]: qLower } },
          boost: 50,
        },
      },
    ];
  }

  private async searchAll(query: string) {
    const q = query.trim();

    const shouldClauses: unknown[] = [
      ...this.buildTitleClauses(q),

      ...this.buildPersonClauses('director', q),

      ...this.buildPersonClauses('cast', q),

      // {
      //   constant_score: {
      //     filter: { term: { genres: q.toLowerCase() } },
      //   },
      // },
      // {
      //   constant_score: {
      //     filter: { prefix: { genres: q.toLowerCase() } },
      //   },
      // },
      { match: { keywords: { query: q, operator: 'and' } } },
    ];

    return this.runSearch(shouldClauses, {
      movie_title: {},
      director: {},
      cast: {},
      genres: {},
      keywords: {},
    });
  }

  private async searchByTitle(query: string) {
    return this.runSearch(this.buildTitleClauses(query), { movie_title: {} });
  }

  private async searchByDirector(query: string) {
    return this.runSearch(this.buildPersonClauses('director', query), {
      director: {},
      movie_title: {},
    });
  }

  private async searchByCast(query: string) {
    return this.runSearch(this.buildPersonClauses('cast', query), {
      cast: {},
      movie_title: {},
    });
  }

  private async searchByKeywordOrGenre(query: string) {
    const qLower = query.trim().toLowerCase();
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
      { match: { keywords: { query, operator: 'and' } }, boost: 30 },
      {
        constant_score: {
          filter: { term: { 'keywords.keyword': qLower }, boost: 50 },
          boost: 2,
        },
      },
    ];
    return this.runSearch(clauses, {
      genres: {},
      keywords: {},
    });
  }

  private async runSearch(
    shouldClauses: unknown[],
    highlightFields: Record<string, object>,
    size = 30,
  ) {
    const res = await this.es.search({
      index: this.index,
      size,
      query: {
        function_score: {
          query: {
            bool: {
              should: shouldClauses as any,
              minimum_should_match: 1,
            },
          },
          functions: [
            {
              field_value_factor: {
                field: 'popularity',
                factor: 100,
                modifier: 'log1p',
                missing: 0,
              },
            },
            {
              field_value_factor: {
                field: 'imdb_rating',
                factor: 50,
                modifier: 'none',
                missing: 0,
              },
            },
            {
              field_value_factor: {
                field: 'imdb_vote_count',
                factor: 20,
                modifier: 'log1p',
                missing: 0,
              },
            },
          ],
          score_mode: 'sum',
          boost_mode: 'sum',
        },
      },
      highlight: {
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        require_field_match: false,
        number_of_fragments: 0,
        fields: highlightFields as any,
      },
      _source: true,
    });

    const result = res.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
      highlight: hit.highlight,
    }));

    return { result };
  }
}
