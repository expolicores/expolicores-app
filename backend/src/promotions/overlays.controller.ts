// src/promotions/overlays.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

@Controller('promotions') // base path → /promotions/*
export class OverlaysController {
  constructor(private readonly promotions: PromotionsService) {}

  // GET /promotions/overlays?audience=B2C|B2B
  @Get('overlays')
  async overlays(@Query('audience') audience: 'B2C' | 'B2B' = 'B2C') {
    const a: 'B2C' | 'B2B' = audience === 'B2B' ? 'B2B' : 'B2C';
    return this.promotions.getOverlayByAudience(a);
  }
}
