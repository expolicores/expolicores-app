// backend/src/auth/jwt.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role, BusinessVerificationStatus, AdminProcessStatus } from '@prisma/client';

type JwtPayload = {
  sub: number;
  email?: string;
  role: Role;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly logEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
    const rawSecret = (config.get<string>('JWT_SECRET') || '').trim();

    // En desarrollo permitimos fallback; en producción exigimos secret válido
    const secretOrKey =
      rawSecret ||
      (nodeEnv !== 'production' ? 'dev-secret' : (() => { throw new Error('JWT_SECRET missing in production'); })());

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // ✅ NO ignorar expiración
      secretOrKey,
    });

    this.logEnabled = (process.env.LOG_JWT || 'false') === 'true';

    if (this.logEnabled) {
      this.logger.log(
        `JWT configured. env=${nodeEnv} secret.length=${String(secretOrKey).length}`,
      );
    }
  }

  /**
   * Validate se ejecuta cuando el token es válido criptográficamente y no está expirado.
   * Aquí resolvemos el usuario y devolvemos la "shape" que se adjunta como req.user
   */
  async validate(payload: JwtPayload) {
    if (this.logEnabled) {
      // No logueamos el token ni emails completos; solo info mínima
      this.logger.debug(
        `JWT payload -> sub=${payload.sub} role=${payload.role}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        businessVerificationStatus: true,
        adminProcessStatus: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    // Si no existe, Passport interpretará "false/null" como Unauthorized (401)
    if (!user) {
      if (this.logEnabled) this.logger.warn(`JWT user not found: sub=${payload.sub}`);
      return null;
    }

    // Lo que retornes aquí queda en req.user
    return {
      id: user.id,
      email: user.email ?? null,
      role: user.role as Role,
      name: user.name ?? null,
      phone: user.phone ?? null,
      businessVerificationStatus: user.businessVerificationStatus as BusinessVerificationStatus,
      adminProcessStatus: user.adminProcessStatus as AdminProcessStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    };
  }
}
