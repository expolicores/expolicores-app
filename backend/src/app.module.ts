// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,      // hace que ConfigService esté disponible en cualquier módulo
      envFilePath: '.env', // apunta a tu .env
    }),
    // aquí luego vendrán tus otros módulos (AuthModule, ProductsModule…)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

