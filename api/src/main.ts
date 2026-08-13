import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { join } from 'path';
import { requestContext } from './common/logging/request-context';
import { httpLogging } from './common/logging/http-logging.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  // Order matters: the id is attached first so every logged line carries one.
  app.use(requestContext);
  app.use(httpLogging);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  // Uploaded bottle images. These are user-supplied bytes, so serve them
  // defensively: `nosniff` stops the browser from re-interpreting a stored
  // image as markup, and the CSP neutralises anything that is interpreted
  // anyway. Directory listings and dotfiles stay off.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    index: false,
    dotfiles: 'deny',
    setHeaders: (res: import('express').Response) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  });
  app
    .getHttpAdapter()
    .get('/health', (_req: unknown, res: import('express').Response) => {
      res.status(200).json({ status: 'ok' });
    });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
