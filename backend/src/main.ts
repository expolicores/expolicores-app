// backend/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import morgan from 'morgan';
import * as bodyParser from 'body-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
// Filtro global para mapear errores Prisma → HTTP
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // Creamos la app (CORS lo configuramos explícitamente luego)
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  // ======= Global Prefix (opcional por ENV) =======
  // Coloca GLOBAL_PREFIX=api en Railway si quieres que todo quede bajo /api/*
  const prefixEnv = (config.get<string>('GLOBAL_PREFIX') || '').trim();
  const globalPrefix = prefixEnv ? prefixEnv.replace(/^\/+|\/+$/g, '') : '';
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  // ======= Raw body (webhooks) =======
  // Guarda el cuerpo "tal cual" para validación de firma
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
  // En dev: origin:true. En prod: define ORIGINS_CSV="https://app.expressapp.net,https://www.expressapp.net"
  const nodeEnv = (config.get<string>('NODE_ENV') || 'development').toLowerCase();
  const originsCsv = (config.get<string>('ORIGINS_CSV') || '').trim();
  const origins =
    nodeEnv === 'production' && originsCsv
      ? originsCsv.split(',').map((s) => s.trim()).filter(Boolean)
      : true; // dev: permitir cualquiera (útil para Expo Go)

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
  // Si hay globalPrefix, Swagger quedará accesible en /<prefix>/docs
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });

  // ======= Puerto/host =======
  const port = Number(config.get('PORT')) || 3000;
  const host = (config.get<string>('HOST') || '0.0.0.0') as '0.0.0.0' | '127.0.0.1';

  await app.listen(port, host);

  // ======= Logs de arranque =======
  const baseUrl = await app.getUrl(); // ej: http://127.0.0.1:8080 en Railway
  const prefixStr = globalPrefix ? `/${globalPrefix}` : '';
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'n/a';

  console.log(`🚀 Servidor corriendo en ${baseUrl}${prefixStr} (host=${host}, env=${nodeEnv}, commit=${commit})`);
  console.log(`📚 Swagger: ${baseUrl}${prefixStr}/docs`);
  console.log(`🌐 CORS origins: ${Array.isArray(origins) ? origins.join(', ') : 'ANY (dev)'}`);
  console.log(
    `💡 Endpoints base: ${baseUrl}${prefixStr}  (ej: ${baseUrl}${prefixStr}/auth/me, ${baseUrl}${prefixStr}/feed)`,
  );
  if (host === '0.0.0.0') {
    console.log(`💡 Desde el iPhone usa: http://<IP_LAN_DE_TU_PC>:${port}${prefixStr}/docs`);
  }
}

bootstrap();
