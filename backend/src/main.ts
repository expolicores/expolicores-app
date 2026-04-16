// backend/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import morgan from 'morgan';
import * as bodyParser from 'body-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // Crear app (CORS se configura abajo)
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  // ======= Global Prefix (solo si ENV está presente y no vacía) =======
  const rawPrefix = (process.env.GLOBAL_PREFIX ?? config.get<string>('GLOBAL_PREFIX') ?? '').trim();
  const globalPrefix = rawPrefix.replace(/^\/+|\/+$/g, '');
  if (globalPrefix.length > 0) {
    app.setGlobalPrefix(globalPrefix);
    console.log('[BOOT] GLOBAL_PREFIX =', `/${globalPrefix}`);
  } else {
    console.log('[BOOT] GLOBAL_PREFIX disabled (routes served at root)');
  }

  // ======= Raw body (webhooks) =======
  app.use(
    bodyParser.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf?.toString();
      },
    }),
  );
  app.use(
    bodyParser.urlencoded({
      extended: true,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf?.toString();
      },
    }),
  );

  // ======= Validación global =======
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ======= Filtro global Prisma =======
  app.useGlobalFilters(new PrismaClientExceptionFilter());

  // ======= CORS =======
  const nodeEnv = (config.get<string>('NODE_ENV') || 'development').toLowerCase();
  const originsCsv = (config.get<string>('ORIGINS_CSV') || '').trim();
  const origins =
    nodeEnv === 'production' && originsCsv
      ? originsCsv.split(',').map((s) => s.trim()).filter(Boolean)
      : true; // dev: cualquiera (útil para Expo Go)

  app.enableCors({
    origin: origins,
    credentials: false,
    exposedHeaders: ['X-Total-Count'],
  });

  // ======= Logs HTTP =======
  app.use(morgan('dev'));

  // ======= Swagger =======
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Expolicores API')
    .setDescription('Documentación de la API de Expolicores')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Con useGlobalPrefix true, Swagger quedará en /docs o /<prefix>/docs
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

  // ======= Puerto/host =======
  const port = Number(config.get('PORT')) || 3000;
  const host = (config.get<string>('HOST') || '0.0.0.0') as '0.0.0.0' | '127.0.0.1';

  await app.listen(port, host);

  // ======= Logs de arranque =======
  const baseUrl = await app.getUrl();
  const prefixStr = globalPrefix ? `/${globalPrefix}` : '';
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'n/a';

  console.log(`🚀 Servidor corriendo en ${baseUrl}${prefixStr} (host=${host}, env=${nodeEnv}, commit=${commit})`);
  console.log(`📚 Swagger: ${baseUrl}${prefixStr}/docs`);
  console.log(
    `💡 Endpoints base: ${baseUrl}${prefixStr}  (ej: ${baseUrl}${prefixStr}/auth/me, ${baseUrl}${prefixStr}/feed)`,
  );
  if (host === '0.0.0.0') {
    console.log(`💡 Desde iPhone (LAN): http://<IP_LAN_DE_TU_PC>:${port}${prefixStr}/docs`);
  }
}

bootstrap();
