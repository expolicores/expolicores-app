import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

type JwtPayload = { sub: number; role: Role };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // por ahora sin expiración
      // Garantiza string: toma de .env o usa fallback local de dev
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
      // Si prefieres fallar al boot si falta el secret:
      // secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });
    return user ? { id: user.id, email: user.email, role: user.role } : null;
  }
}
