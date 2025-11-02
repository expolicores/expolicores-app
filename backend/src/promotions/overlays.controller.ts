import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

/**
 * Controlador PÚBLICO/AUTENTICADO
 * Rutas accesibles para usuarios logueados (B2C/B2B/ADMIN) bajo /promotions
 * NO requiere rol ADMIN.
 *
 * GET /promotions/overlays?audience=B2C|B2B
 * Respuesta: [{ id, name, productId, price?, imageUrl?, bannerKey? }]
 */
@Controller('promotions')
@UseGuards(JwtAuthGuard)
export class OverlaysController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('overlays')
  async overlays(@Query('audience') audience: 'B2C' | 'B2B' = 'B2C') {
    const a: 'B2C' | 'B2B' = audience === 'B2B' ? 'B2B' : 'B2C';
    return this.promotions.getOverlayByAudience(a);
  }
}
