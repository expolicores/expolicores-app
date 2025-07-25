import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  // 1) Arranca la app con tu módulo principal
  const app = await NestFactory.create(AppModule);

  // 2) Obtiene el ConfigService
  const config = app.get(ConfigService);

  // 3) Lee el puerto de la configuración (o usa 3000 de fallback)
  const port = config.get<number>('PORT') || 3000;

  // 4) Inicia el servidor en ese puerto
  await app.listen(port);
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
}

bootstrap();


