// src/orders/orders.controller.ts
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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiParam,
} from '@nestjs/swagger';

// 👇 NUEVO: guard que valida "dueño o admin"
import { SelfOrAdminGuard } from '../auth/guards/self-or-admin.guard';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Crear orden (cliente autenticado)
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Crear una orden desde el carrito' })
  @ApiCreatedResponse({ description: 'Orden creada (RECIBIDO)' })
  @ApiBadRequestResponse({ description: 'EMPTY_CART | ADDRESS_MISSING_GEO | COVERAGE_OUT_OF_RANGE' })
  @ApiNotFoundResponse({ description: 'ADDRESS_NOT_FOUND | PRODUCT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'OUT_OF_STOCK:<productId>' })
  @ApiUnauthorizedResponse()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(userId, dto);
  }

  // Mis órdenes (cliente autenticado)
  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiOperation({ summary: 'Listar mis órdenes' })
  @ApiOkResponse({ description: 'Listado de órdenes del usuario (incluye status y totales)' })
  @ApiUnauthorizedResponse()
  findMine(@CurrentUser('id') userId: number) {
    return this.ordersService.findMine(userId);
  }

  // Ver UNA orden (dueño o ADMIN) -> usado por OrderTrackingScreen
  @UseGuards(JwtAuthGuard) // 👈 solo autenticación; la autorización va en el service
  @Get(':id')
  @ApiOperation({ summary: 'Ver una orden por id (dueño o ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description:
      'Detalle de la orden: { id, status, total, createdAt, updatedAt, items[{ product{name, imageUrl, price}, quantity }]}',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnauthorizedResponse()
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: Role },
  ) {
    return this.ordersService.findOneForUser(id, user); // 👈 pasa el user al service
  }

  // Listar TODAS las órdenes (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Listar todas las órdenes (ADMIN)' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  findAll() {
    return this.ordersService.findAll();
  }

  // Actualizar (items/otros) - normalmente ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una orden (ADMIN)' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Order with ID :id not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  // Cambiar estado (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado de la orden (ADMIN)' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
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
  @ApiOperation({ summary: 'Eliminar una orden (ADMIN)' })
  @ApiOkResponse()
  @ApiForbiddenResponse()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
