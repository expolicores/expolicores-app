// backend/src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import * as bodyParser from 'body-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// Filtro global para mapear errores Prisma → HTTP
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // Creamos la app (desactivamos CORS aquí; lo configuramos abajo)
  const app = await NestFactory.create(AppModule, { cors: false });

  const config = app.get(ConfigService);

  // ======= Global Prefix opcional (por ENV) =======
  // Coloca GLOBAL_PREFIX=api en Railway si quieres que todo quede bajo /api/*
  const globalPrefix = (config.get<string>('GLOBAL_PREFIX') || '').trim();
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix.replace(/^\/+|\/+$/g, '')); // quita slashes
  }

  // ======= Raw body (Twilio + otros webhooks) =======
  // Guarda el cuerpo "tal cual" para validación de firma (JSON y x-www-form-urlencoded)
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
  // En desarrollo: origin: true. En producción: define ORIGINS_CSV="https://app.expressapp.net,https://www.expressapp.net"
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
  // No usamos "include" para que entre TODO lo registrado (auth, feed, etc.)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Expolicores API')
    .setDescription('Documentación de la API de Expolicores')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // ======= Puerto/host =======
  const port = Number(config.get('PORT')) || 3000;
  const host = (config.get<string>('HOST') || '0.0.0.0') as '0.0.0.0' | '127.0.0.1';

  await app.listen(port, host);

  const baseUrl = await app.getUrl(); // ej: http://127.0.0.1:8080 en Railway
  const prettyPrefix = globalPrefix ? `/${globalPrefix}` : '';
  console.log(`🚀 Servidor corriendo en ${baseUrl}${prettyPrefix ? '' : ''} (host=${host})`);
  console.log(`📚 Swagger: ${baseUrl}/docs`);
  console.log(
    `💡 Endpoints base: ${baseUrl}${prettyPrefix || ''}  (ej: ${baseUrl}${prettyPrefix}/auth/me, ${baseUrl}${prettyPrefix}/feed)`,
  );
  console.log(`💡 Desde el iPhone usa: http://<IP_LAN_DE_TU_PC>:${port}/docs`);
}

bootstrap();
