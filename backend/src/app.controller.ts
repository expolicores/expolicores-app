// backend/src/app.controller.ts
import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { validateGeo, ValidateGeoInput, ValidateGeoResponse } from './common/geo';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async health() {
    const users = await this.appService.countUsers();
    return {
      status: 'ok',
      userCount: users,
    };
  }

  /**
   * Valida cobertura y calcula costo de envío.
   * - Cobertura: distancia a TIENDA <= DELIVERY_RADIUS_KM
   * - Precio: Tarifa Clásica o Urbana V2 (según env FEATURE_TARIFF_URBAN_V2)
   */
  @Post('geo/validate')
  validateGeoEndpoint(@Body() body: ValidateGeoInput): ValidateGeoResponse {
    try {
      return validateGeo(body);
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? 'Solicitud inválida');
    }
  }
}
