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

// 🆕 Bodega (B2B) — solo NEGOCIO/ADMIN vía RolesGuard en su controller
import { BodegaModule } from './bodega/bodega.module';

@Module({
  imports: [
    // Carga .env global (ConfigService disponible en toda la app)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Módulos de dominio/infra
    PrismaModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    ProductsModule,
    OrdersModule, // dentro de OrdersModule ya importas shippingConfig

    // 🆕 Registrar el módulo B2B
    BodegaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
