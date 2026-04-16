import { Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';

import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  listMine(@CurrentUser('id') userId: number) {
    return this.favoritesService.listProducts(userId);
  }

  @Post(':productId')
  async addFavorite(
    @CurrentUser('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.favoritesService.add(userId, productId);
  }

  @Delete(':productId')
  async removeFavorite(
    @CurrentUser('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.favoritesService.remove(userId, productId);
    return { ok: true };
  }
}
