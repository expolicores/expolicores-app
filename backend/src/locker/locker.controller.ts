// backend/src/locker/locker.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { LockerService } from './locker.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('locker')
@UseGuards(JwtAuthGuard)
export class LockerController {
  constructor(private readonly lockerService: LockerService) {}

  // =========== B2B: casillero propio ===========

  @Get()
  async getMyLocker(
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: Role,
  ) {
    return this.lockerService.getMyLocker(userId, role);
  }

  @Post(':productId')
  async addToLocker(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: Role,
  ) {
    return this.lockerService.addToLocker(userId, role, productId);
  }

  @Delete(':productId')
  async removeFromLocker(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: Role,
  ) {
    return this.lockerService.removeFromLocker(userId, role, productId);
  }

  // =========== ADMIN: vistas agregadas ===========

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/summary')
  async adminSummary() {
    return this.lockerService.adminSummary();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/by-user/:userId')
  async adminGetLockerByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.lockerService.adminGetLockerByUser(userId);
  }
}
