// src/promotions/promotions.module.ts
import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import { OverlaysController } from './overlays.controller';
// Si ya tienes un PromotionsController para CRUD/admin, déjalo como está e impórtalo aquí también:
import { PromotionsController } from './promotions.controller'; // <-- si existe en tu repo

@Module({
  controllers: [
    OverlaysController,
    PromotionsController, // quita esta línea si NO tienes este archivo
  ],
  providers: [PromotionsService, PrismaService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
