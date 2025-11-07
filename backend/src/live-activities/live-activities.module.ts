import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LiveActivitiesService } from './live-activities.service';
import { LiveActivitiesController } from './live-activities.controller';

@Module({
  providers: [PrismaService, LiveActivitiesService],
  controllers: [LiveActivitiesController],
  exports: [LiveActivitiesService],
})
export class LiveActivitiesModule {}