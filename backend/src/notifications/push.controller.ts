// backend/src/notifications/push.controller.ts
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushService } from './push.service';
import { RegisterPushDto } from './dto/register-push.dto';

type CurrentUserShape = { id: number; role?: string; phone?: string; email?: string };

/**
 * Controlador de notificaciones push (Expo/FCM)
 * - Mantiene contrato estable: POST /notifications/push/register
 * - Agrega:
 *    • POST /notifications/push/test    -> smoke/test hacia tokens del usuario
 *    • DELETE /notifications/push/register -> desregistrar token (opcional)
 */
@UseGuards(JwtAuthGuard)
@Controller('notifications/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /**
   * Registra o actualiza el token Expo del usuario (multi-dispositivo).
   * Body: { token: string; platform?: 'android'|'ios' }
   */
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@CurrentUser() user: CurrentUserShape, @Body() dto: RegisterPushDto) {
    // Validación defensiva mínima en el controlador (la validación fuerte vive en el servicio/DTO)
    if (!dto?.token || typeof dto.token !== 'string') {
      throw new BadRequestException('token requerido');
    }
    // Expo push tokens suelen empezar por "ExponentPushToken[" (dev) o ser eXPo... (clásico).
    // No bloqueamos estrictamente, pero avisamos si el formato luce mal.
    const looksLikeExpoToken =
      dto.token.startsWith('ExponentPushToken[') || dto.token.includes('ExpoPushToken');
    if (!looksLikeExpoToken && dto.token.length < 20) {
      // No lanzamos error duro para no romper clientes; dejamos registro en servicio.
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
  async unregister(@CurrentUser() user: CurrentUserShape, @Body() body: { token?: string }) {
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
    return {
      ok: true,
      ...result,
    };
  }
}
