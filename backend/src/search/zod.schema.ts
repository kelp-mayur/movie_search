import { z } from 'zod';

export const SearchSchema = z.object({
  query: z.string().min(1, 'Query is required and cannot be empty'),
  type: z.enum(['all', 'movie', 'director', 'actor', 'keyword']).optional(),
});

export type SearchDto = z.infer<typeof SearchSchema>;
