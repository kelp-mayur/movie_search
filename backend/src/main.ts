import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.warn('FRONTEND_URL not set, CORS disabled');
  }
  app.enableCors({
    origin: frontendUrl || false,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  throw err;
});
