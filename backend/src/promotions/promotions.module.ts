import { Module } from '@nestjs/common';
import { PromotionsController } from 'src/promotions/promotions.controller';
import { PromotionsService } from 'src/promotions/promotions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
