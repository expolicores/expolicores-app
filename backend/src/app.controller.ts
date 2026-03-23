// backend/src/app.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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

  /**
   * Feed del home.
   * Comportamiento:
   *  - Si FEED_INLINE_JSON=1 y existe appService.getFeed(), responde JSON inline.
   *  - Si R2_FEED_LATEST_URL está configurado, redirige 302 a ese recurso (R2/Cloudflare).
   *  - Si nada está configurado, devuelve 400.
   *
   * Nota: Mantiene el contrato que usa el frontend:
   *  - La app puede pedir /feed y recibir el JSON directamente o seguir la redirección.
   */
  @Get('feed')
  async getFeed(@Res() res: Response) {
    const useInline = (process.env.FEED_INLINE_JSON || '0') === '1';
    const r2Url = process.env.R2_FEED_LATEST_URL;

    // Opción 1: Inline (si está habilitado y existe el método)
    if (useInline && typeof (this.appService as any)?.getFeed === 'function') {
      try {
        const feedJson = await (this.appService as any).getFeed();
        return res
          .status(200)
          .setHeader('Cache-Control', 'public, max-age=30')
          .json(feedJson);
      } catch (e: any) {
        throw new BadRequestException(e?.message ?? 'No se pudo generar el feed inline');
      }
    }

    // Opción 2: Redirección a R2 (recomendada en producción)
    if (r2Url && r2Url.startsWith('http')) {
      // 302 para permitir clientes con cache corto; puedes usar 307 si prefieres.
      return res.redirect(302, r2Url);
    }

    // Sin configuración válida
    throw new BadRequestException(
      'Feed no configurado. Define R2_FEED_LATEST_URL o habilita FEED_INLINE_JSON=1',
    );
  }
}
