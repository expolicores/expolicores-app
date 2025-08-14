import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// 👇 Swagger
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Validation global con mejores prácticas
  app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));

  // ✅ Swagger docs en /docs
  const configSwagger = new DocumentBuilder()
    .setTitle('Expolicores API')
    .setDescription('Documentación de la API de Expolicores')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, configSwagger);
  SwaggerModule.setup('docs', app, document);

  // ✅ Configuración de puerto
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;

  await app.listen(port);
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`📚 Swagger docs disponibles en http://localhost:${port}/docs`);
}

bootstrap();
