import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { AdminBusinessController } from './business.admin.controller';

@Module({
  imports: [PrismaModule],
  providers: [BusinessService],
  controllers: [BusinessController, AdminBusinessController],
})
export class BusinessModule {}
