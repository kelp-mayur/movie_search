import { z } from 'zod';

export const SearchSchema = z.object({
  query: z.string().min(1, 'Query is required and cannot be empty'),
  type: z.enum(['all', 'movie', 'director', 'actor', 'keyword']).optional(),
});

export const SuggestionSchema = z.object({
  query: z.string().min(1, 'Query is required and cannot be empty'),
  size: z.coerce.number().int().min(1).max(25).optional(),
});

export type SearchDto = z.infer<typeof SearchSchema>;
export type SuggestionDto = z.infer<typeof SuggestionSchema>;
