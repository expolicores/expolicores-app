import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
// Si prefieres usar el enum de Prisma:
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.NEGOCIO, Role.ADMIN) // 👈 solo NEGOCIO/ADMIN entran a todo el controller
@Controller('bodega')
export class BodegaController {
  @Get('ping')
  ping() {
    return { ok: true, scope: 'B2B-only' };
  }

  // Ejemplo de ruta con rol más estricto (opcional):
  // @Get('solo-negocio')
  // @Roles(Role.NEGOCIO)
  // onlyNegocio() { return { ok: true }; }
}
