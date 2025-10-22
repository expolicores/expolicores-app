import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';
import { ValidateGeoDto } from './dto/validate-geo.dto';
import type { ValidateGeoResponse } from './types/validate-geo.response';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService, private readonly cfg: ConfigService) {}

  @Post('validate')
  async validate(@Body() body: ValidateGeoDto): Promise<ValidateGeoResponse> {
    // MVP: esperamos coords desde el cliente (Place Details). Si no vienen en body.lat/lng,
    // aceptamos las que vengan anidadas en normalizedAddress.
    const lat = body.lat ?? body.normalizedAddress?.lat;
    const lng = body.lng ?? body.normalizedAddress?.lng;

    const resp = this.geo.validateCoverage(lat as number, lng as number, body.normalizedAddress as any);
    return resp;
  }
}
