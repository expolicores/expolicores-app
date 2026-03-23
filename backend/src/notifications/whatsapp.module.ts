// src/notifications/whatsapp.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import whatsappConfig from '../config/whatsapp';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    PrismaModule, // para guardar NotificationLog y consultas
    ConfigModule.forFeature(whatsappConfig), // inyecta configuración tipada de WhatsApp
  ],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
