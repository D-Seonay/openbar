import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  // Lightweight health endpoint used by Docker healthcheck probe
  app.getHttpAdapter().get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
