import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';
import { UpdateOrderStatusDto } from './update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Crear orden (cliente autenticado)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(userId, dto);
  }

  // Mis órdenes (cliente autenticado)
  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMine(@CurrentUser('id') userId: number) {
    return this.ordersService.findMine(userId);
  }

  // Ver una orden (dueño o ADMIN)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: Role },
  ) {
    return this.ordersService.findOneAs(id, user);
  }

  // Listar todas las órdenes (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  // Actualizar (items/otros) - normalmente ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  // Cambiar estado (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  // Eliminar orden (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
