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
  // Crea la app (CORS lo configuramos abajo)
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  // ===== Global Prefix (opcional) =====
  // Si defines GLOBAL_PREFIX=api en Railway, todo quedará en /api/*
  const prefixEnv = (config.get<string>('GLOBAL_PREFIX') || '').trim();
  const globalPrefix = prefixEnv ? prefixEnv.replace(/^\/+|\/+$/g, '') : '';
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  // ===== Raw body (webhooks) =====
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

  // ===== Validación global =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ===== Filtro Prisma =====
  app.useGlobalFilters(new PrismaClientExceptionFilter());

  // ===== CORS =====
  // En prod: ORIGINS_CSV="https://lo-que-sea.com,https://otra.com"
  const nodeEnv = (config.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development').toLowerCase();
  const originsCsv = (config.get<string>('ORIGINS_CSV') || process.env.ORIGINS_CSV || '').trim();
  const origins =
    nodeEnv === 'production' && originsCsv
      ? originsCsv.split(',').map((s) => s.trim()).filter(Boolean)
      : true; // dev: permitir cualquiera (útil para Expo Go y pruebas)

  app.enableCors({
    origin: origins,
    credentials: false,
    exposedHeaders: ['X-Total-Count'],
  });

  // ===== HTTP logs =====
  app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'));

  // ===== Swagger =====
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Expolicores API')
    .setDescription('Documentación de la API de Expolicores')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Si hay globalPrefix, Swagger quedará en /<prefix>/docs
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

  // ===== Puerto/host =====
  // En Railway/Nixpacks/Docker, hay que bindear SIEMPRE a 0.0.0.0
  const port =
    Number(config.get('PORT')) ||
    Number(process.env.PORT) ||
    3000;
  const host: '0.0.0.0' = '0.0.0.0';

  await app.listen(port, host);

  // ===== Logs de arranque =====
  const baseUrl = await app.getUrl(); // p.ej. http://0.0.0.0:3000 (Railway hace proxy)
  const prefixStr = globalPrefix ? `/${globalPrefix}` : '';
  const commit =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    'n/a';
  const builtAt = process.env.BUILD_TIME || null;

  console.log(`🚀 API escuchando en ${baseUrl}${prefixStr} (env=${nodeEnv}, commit=${commit}, builtAt=${builtAt})`);
  console.log(`📚 Swagger: ${baseUrl}${prefixStr}/docs`);
  console.log(
    `🌐 CORS origins: ${Array.isArray(origins) ? origins.join(', ') : 'ANY (dev)'}`
  );
}

bootstrap();
