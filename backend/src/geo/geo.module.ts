// backend/src/geo/geo.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [ConfigModule],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
