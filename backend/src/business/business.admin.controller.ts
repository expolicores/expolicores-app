import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessService } from './business.service';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { UpdateAdminProcessDto } from './dto/update-admin-process.dto';
import { BusinessVerificationStatus, Role } from '@prisma/client';

@Controller('admin/business')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminBusinessController {
  constructor(private service: BusinessService) {}

  @Get('applications')
  async list(@Query('status') status?: string) {
    const verification = status
      ? status.split(',').map((s) => s.trim().toUpperCase() as BusinessVerificationStatus)
      : undefined;
    return this.service.listApplications({ verification });
  }

  @Patch(':userId/verification')
  async setVerification(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateVerificationDto,
  ) {
    return this.service.setVerification(userId, dto.status);
  }

  @Patch(':userId/admin-process')
  async setAdminProcess(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateAdminProcessDto,
  ) {
    return this.service.setAdminProcess(userId, dto.status);
  }
}
