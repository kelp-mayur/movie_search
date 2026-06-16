import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UsePipes,
} from '@nestjs/common';
import { SearchService } from './search.service';
import * as zodSchema from './zod.schema';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('/api/v1')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get('/movies/search')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(zodSchema.SearchSchema))
  async searchMovies(@Query() dto: zodSchema.SearchDto) {
    return this.searchService.search(dto);
  }

  @Get('/movie/:id')
  @HttpCode(HttpStatus.OK)
  async movieDetails(@Param('id') id: string) {
    return this.searchService.movieDetails(id);
  }
}