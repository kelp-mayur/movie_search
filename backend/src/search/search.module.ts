import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [],
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_API'),
        auth: {
          apiKey: configService.get<string>('ELASTICSEARCH_KEY')!,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
