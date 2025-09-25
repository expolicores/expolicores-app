import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // ⬅️ importa

@Controller('orders/:id/notifications')
@UseGuards(JwtAuthGuard, RolesGuard) // ⬅️ agrega JwtAuthGuard ANTES del RolesGuard
@Roles('ADMIN')
export class OrderNotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.notificationLog.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
