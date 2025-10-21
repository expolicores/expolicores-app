// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { FavoritesModule } from './favorites/favorites.module';
import features from './config/features';

// Bodega (B2B) — catálogo/operaciones para NEGOCIO/ADMIN
import { BodegaModule } from './bodega/bodega.module';

// Business — flujo “Soy negocio”: solicitudes, estados admin y verificación
import { BusinessModule } from './business/business.module';

@Module({
  imports: [
    // Config global (.env) + feature flags
    ConfigModule.forRoot({
      isGlobal: true,
      load: [features],
      envFilePath: '.env',
    }),

    // Infra / dominio
    PrismaModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    ProductsModule,
    OrdersModule,
    FavoritesModule,

    // Módulos B2B
    BodegaModule, // acceso real a Bodega Virtual (protegido por RolesGuard/B2BApprovedGuard)
    BusinessModule, // gestión de solicitudes B2B (apply, admin list/approve/reject)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
