import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import whatsappConfig from '../config/whatsapp';
import { WhatsAppService } from './whatsapp.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,                        // <- para loguear envíos
    ConfigModule.forFeature(whatsappConfig),
  ],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
