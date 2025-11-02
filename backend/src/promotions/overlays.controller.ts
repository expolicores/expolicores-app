import { Controller, Get, Query } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class OverlaysController {
  constructor(private readonly promotions: PromotionsService) {}
  // prettier-ignore
  @Get('overlays')
  async overlays(
    @Query('audience') audience: 'B2C' | 'B2B' = 'B2C',
    @Query('limit') limit?: string,
  ) {
    const a: 'B2C' | 'B2B' = audience === 'B2B' ? 'B2B' : 'B2C';
    const n = limit ? Number(limit) : undefined;
    return this.promotions.getOverlayByAudience(a, n);
  }
}
