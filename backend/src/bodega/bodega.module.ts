import { Module } from '@nestjs/common';
import { BodegaController } from './bodega.controller';
import { BodegaService } from './bodega.service';

@Module({
  controllers: [BodegaController],
  providers: [BodegaService],
})
export class BodegaModule {}
