// backend/src/locker/locker.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LockerService } from './locker.service';
import { LockerController } from './locker.controller';

@Module({
  imports: [PrismaModule],
  providers: [LockerService],
  controllers: [LockerController],
})
export class LockerModule {}
