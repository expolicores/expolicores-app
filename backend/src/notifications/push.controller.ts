// backend/src/notifications/push.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushService } from './push.service';
import { RegisterPushDto } from './dto/register-push.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('register')
  async register(@CurrentUser() user: any, @Body() dto: RegisterPushDto) {
    await this.push.register(user.id, dto);
    return { ok: true };
  }
}
