// backend/src/notifications/push.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RegisterPushInput = {
  userId: number | string;
  token: string;
  platform: 'ios' | 'android';
};

@Injectable()
export class PushService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: number | string, dto: { token: string; platform: 'ios' | 'android' }) {
    // userId en tu schema es Int; aseguramos número
    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    await this.prisma.userPushToken.upsert({
      where: { token: dto.token },
      update: { userId: uid, platform: dto.platform, lastUsedAt: new Date() },
      create: { userId: uid, token: dto.token, platform: dto.platform },
    });

    return { ok: true };
  }

  async tokensForUser(userId: number) {
    return this.prisma.userPushToken.findMany({ where: { userId } });
  }

  async removeToken(token: string) {
    try {
      await this.prisma.userPushToken.delete({ where: { token } });
    } catch {
      // token inexistente: ignore
    }
  }
}
