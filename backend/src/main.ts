// backend/src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import * as bodyParser from 'body-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// ⬇️ Filtro global para mapear errores Prisma → HTTP
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  // Creamos la app (desactivamos CORS aquí para configurarlo manualmente abajo)
  const app = await NestFactory.create(AppModule, { cors: false });

  // ===== Raw body (Twilio + otros webhooks) =====
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

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Filtro global de Prisma (P2025, P2002, etc.)
  app.useGlobalFilters(new PrismaClientExceptionFilter());

  // CORS: para dev permitir origen dinámico; en prod restringe por dominio
  app.enableCors({
    origin: true, // TODO: en prod usar ['https://app.expressapp.net', 'https://app.expolicores.co']
    credentials: false,
    exposedHeaders: ['X-Total-Count'],
  });

  // Logs HTTP
  app.use(morgan('dev'));

  // Swagger en /docs + Bearer auth (JWT)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Expolicores API')
    .setDescription('Documentación de la API de Expolicores')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Puerto/host
  const config = app.get(ConfigService);
  const port = Number(config.get('PORT')) || 3000;
  const host = (config.get<string>('HOST') || '0.0.0.0') as '0.0.0.0' | '127.0.0.1';

  await app.listen(port, host);

  const url = await app.getUrl(); // p.ej. http://localhost:3000
  console.log(`🚀 Servidor corriendo en ${url} (host=${host})`);
  console.log(`📚 Swagger: ${url}/docs`);
  console.log('💡 Desde el iPhone usa:  http://<IP_LAN_DE_TU_PC>:' + port + '/docs');
}
bootstrap();
