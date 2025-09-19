import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  // Creamos la app (desactivamos CORS aquí para configurarlo manualmente abajo)
  const app = await NestFactory.create(AppModule, { cors: false });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS para dev: permitir origenes locales y exponer X-Total-Count al FE
  app.enableCors({
    origin: true,                 // en prod, reemplaza por tu dominio(s)
    credentials: false,
    exposedHeaders: ['X-Total-Count'],
  });

  // Logs HTTP
  app.use(morgan('dev'));

  // Swagger en /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Expolicores API')
    .setDescription('Documentación de la API de Expolicores')
    .setVersion('1.0')
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
