import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const node = configService.get<string>('ELASTICSEARCH_API') ?? 'http://localhost:9200';
        const apiKey = configService.get<string>('ELASTICSEARCH_KEY');

        return {
          node,
          // Only attach auth if apiKey is present; local dev connects without auth
          ...(apiKey ? { auth: { apiKey } } : {}),
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
