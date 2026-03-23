import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { haversineKm } from '../common/geo';
import type { NormalizedAddress } from './types/validate-geo.response';
import type { ValidateGeoResponse } from './types/validate-geo.response';

@Injectable()
export class GeoService {
  private readonly storeLat: number;
  private readonly storeLng: number;
  private readonly radiusKm: number;
  private readonly shippingBase: number;
  private readonly shippingPerKm: number;
  private readonly shippingMin: number;

  constructor(private readonly cfg: ConfigService) {
    // Mover lectura de envs al constructor (ya existe this.cfg)
    this.storeLat = Number(this.cfg.get('STORE_LAT') ?? 0);
    this.storeLng = Number(this.cfg.get('STORE_LNG') ?? 0);
    this.radiusKm = Number(this.cfg.get('DELIVERY_RADIUS_KM') ?? 0);
    this.shippingBase = Number(this.cfg.get('SHIPPING_BASE') ?? 0);
    this.shippingPerKm = Number(this.cfg.get('SHIPPING_PER_KM') ?? 0);
    this.shippingMin = Number(this.cfg.get('SHIPPING_MIN') ?? 0);
  }

  validateCoverage(lat: number, lng: number, normalized?: NormalizedAddress): ValidateGeoResponse {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        inCoverage: false,
        distanceKm: 0,
        shippingCost: this.shippingMin,
        normalizedAddress: normalized,
        reason: 'INVALID_COORDS',
      };
    }

    const distance = haversineKm(
      { lat: this.storeLat, lng: this.storeLng },
      { lat, lng },
    );
    const distanceRounded = Math.round(distance * 10) / 10; // 0.1 km

    const variable = this.shippingPerKm * distanceRounded;
    const cost = Math.max(this.shippingMin, this.shippingBase + variable);

    const inCoverage = distance <= this.radiusKm;

    return {
      inCoverage,
      distanceKm: distanceRounded,
      shippingCost: Math.round(cost),
      normalizedAddress: normalized,
      reason: inCoverage ? 'OK' : 'OUT_OF_RADIUS',
    };
  }
}
