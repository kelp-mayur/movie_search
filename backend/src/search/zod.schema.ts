import { z } from 'zod';

export const SearchSchema = z.object({
  query: z.string().min(1, 'Query is required and cannot be empty'),
  type: z.enum(['all', 'movie', 'director', 'actor', 'keyword']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  genre: z.string().optional(),
});

export type SearchDto = z.infer<typeof SearchSchema>;
