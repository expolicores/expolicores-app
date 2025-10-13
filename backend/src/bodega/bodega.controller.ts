// src/bodega/bodega.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
// Solo BUSINESS (antes NEGOCIO) y ADMIN pueden acceder a todo el controller
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller('bodega')
export class BodegaController {
  @Get('ping')
  ping() {
    return { ok: true, scope: 'B2B-only' };
  }

  // Ejemplo de ruta aún más estricta (solo BUSINESS):
  // @Get('solo-negocio')
  // @Roles(Role.BUSINESS)
  // onlyNegocio() {
  //   return { ok: true, scope: 'BUSINESS' };
  // }
}
