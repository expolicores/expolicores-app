import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushService } from './push.service';
import { RegisterPushDto } from './dto/register-push.dto';

type CurrentUserShape = { id: number; role?: string; phone?: string; email?: string };

/**
 * Controlador de notificaciones push (Expo/FCM)
 * Contratos públicos:
 *  - POST   /notifications/push/register   -> upsert de tokens por usuario (multi-dispositivo)
 *  - DELETE /notifications/push/register   -> elimina un token del usuario
 *  - POST   /notifications/push/test       -> smoke test a todos los tokens del usuario
 */
@UseGuards(JwtAuthGuard)
@Controller('notifications/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /**
   * Registra o actualiza el token Expo del usuario (idempotente).
   * Body: { token: string; platform?: 'android'|'ios' }
   */
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @CurrentUser() user: CurrentUserShape,
    @Body() dto: RegisterPushDto,
  ) {
    if (!dto?.token || typeof dto.token !== 'string') {
      throw new BadRequestException('token requerido');
    }

    // Formato típico de Expo push tokens (no bloqueante, solo heurística)
    const looksLikeExpoToken =
      dto.token.startsWith('ExponentPushToken[') ||
      dto.token.includes('ExpoPushToken') ||
      dto.token.startsWith('ExpoPushToken[');
    if (!looksLikeExpoToken && dto.token.length < 20) {
      // No arrojamos error duro para no romper clientes antiguos.
      // El servicio puede registrar advertencias si se desea.
    }

    await this.push.register(user.id, dto);
    return { ok: true };
  }

  /**
   * Desregistra un token específico del usuario (logout/purga manual).
   * Body: { token: string }
   */
  @Delete('register')
  @HttpCode(HttpStatus.OK)
  async unregister(
    @CurrentUser() user: CurrentUserShape,
    @Body() body: { token?: string },
  ) {
    if (!body?.token || typeof body.token !== 'string') {
      throw new BadRequestException('token requerido');
    }
    const removed = await this.push.unregister(user.id, body.token);
    return { ok: true, removed };
  }

  /**
   * Envía un push de prueba a todos los tokens del usuario actual.
   * Útil para smoke E2E sin crear órdenes.
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTest(@CurrentUser() user: CurrentUserShape) {
    const result = await this.push.sendTestToUser(user.id);
    // result puede incluir: deliveredCount, failedCount, invalidTokens[], receipts[]
    return { ok: true, ...result };
  }
}
