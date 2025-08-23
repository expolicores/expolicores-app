// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { AddressesModule } from './addresses/addresses.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // correcto aquí
    }),
    PrismaModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    AuthModule,
    AddressesModule, // ¡aquí sí va PrismaModule!
    // otros módulos que agregarás después
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
