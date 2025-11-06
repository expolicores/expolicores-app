// backend/src/notifications/push.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PushService, RegisterPushDto } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type CurrentUserType = { id: number; email?: string; role?: string };

@Controller('notifications/push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /**
   * Registra token del dispositivo actual.
   * Body: { token: string, platform: 'ios'|'android' }
   */
  @Post('register')
  async register(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: RegisterPushDto,
  ) {
    return this.push.register(user.id, dto);
  }

  /**
   * Test: envía una notificación de prueba a TODOS los tokens del usuario.
   */
  @Post('test')
  async test(@CurrentUser() user: CurrentUserType) {
    const res = await this.push.sendToUser(user.id, {
      title: '🔔 Prueba de notificación',
      body: 'Hola, este es un envío de prueba.',
      data: { type: 'TEST' },
      priority: 'high',
      sound: 'default',
    });
    // res ya incluye { ok: true, sent, invalid }
    return res;
  }

  /**
   * (Opcional) Ver tus tokens registrados
   */
  @Get('my-tokens')
  async myTokens(@CurrentUser() user: CurrentUserType) {
    const tokens = await this.push.tokensForUser(user.id);
    return { ok: true, count: tokens.length, tokens };
  }
}
