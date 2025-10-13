// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../notifications/whatsapp.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    // Carga .env a nivel global (si ya está en AppModule, puedes quitar este bloque aquí)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),

    PrismaModule,
    WhatsAppModule,

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'dev_secret'),
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, JwtModule, PassportModule, RolesGuard],
})
export class AuthModule {}
