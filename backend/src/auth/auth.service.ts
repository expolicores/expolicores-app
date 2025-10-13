// backend/src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

import { Role, User } from '@prisma/client';
import { WhatsAppService } from '../notifications/whatsapp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Configurables por .env
  private readonly OTP_COOLDOWN_SECONDS = Number(
    process.env.OTP_COOLDOWN_SECONDS ?? 60,
  );
  private readonly OTP_TTL_SECONDS = Number(
    process.env.OTP_TTL_SECONDS ?? 10 * 60, // 10 min
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ========== Helpers ==========
  public normalizeEmail(email?: string | null) {
    return String(email ?? '').trim().toLowerCase();
  }

  /** Normaliza a E.164 CO (+57...) desde formatos comunes. */
  public normalizePhone(raw?: string | null) {
    const s = String(raw ?? '').replace(/[^\d+]/g, '');
    if (!s) return '';
    if (s.startsWith('+')) return s;
    const digits = s.replace(/^0+/, '');
    if (digits.startsWith('57')) return `+${digits}`;
    return `+57${digits}`;
  }

  private generate6(): string {
    const n = Math.floor(100000 + Math.random() * 900000);
    return String(n);
  }

  /** Firma JWT — público para uso desde el controller. */
  public async signToken(user: { id: number; email?: string | null; role: Role }) {
    const payload = { sub: user.id, email: user.email ?? '', role: user.role };
    const access_token = await this.jwt.signAsync(payload, { expiresIn: '7d' });
    return { access_token };
  }

  /** Envío OTP por WA respetando flags. */
  private async trySendOtp(toPhone: string, code: string) {
    const FEATURE = process.env.FEATURE_WHATSAPP_NOTIFICATIONS === 'true';
    const SEND = process.env.SEND_WHATSAPP_NOTIFS === 'true';
    if (!FEATURE || !SEND) {
      this.logger.debug(`[WA OFF] OTP a ${toPhone} (no enviado)`);
      return;
    }
    await this.whatsapp.sendOtp(toPhone, code);
  }

  /** Genera y persiste token para verificación de email. */
  private async enqueueEmailVerificationToken(userId: number) {
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.emailVerificationToken.create({
      data: { userId, token, expiresAt },
    });
    return token;
  }

  private maskPhone(p: string) {
    const digits = p.replace(/\D/g, '');
    if (digits.length < 6) return p;
    const tail = digits.slice(-4);
    return `+57*****${tail}`;
  }

  // ========== OTP-first ==========

  async requestOtp(
    dto: RequestOtpDto,
  ): Promise<{
    ok: true;
    phoneMasked: string;
    throttled?: boolean;
    remainingSeconds?: number;
    cooldownSeconds: number;
    expiresInSeconds: number;
    devOtp?: string;
  }> {
    const isDevEcho =
      process.env.NODE_ENV !== 'production' ||
      process.env.LOG_OTP_DEV === 'true';

    let phone = '';

    if (dto.phone) {
      phone = this.normalizePhone(dto.phone);
    } else if (dto.email) {
      const email = this.normalizeEmail(dto.email);
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user || !user.phone || !user.isPhoneVerified) {
        throw new BadRequestException(
          'No hay teléfono verificado asociado a ese correo',
        );
      }
      phone = this.normalizePhone(user.phone);
    } else {
      throw new BadRequestException('Debes enviar phone o email');
    }

    // Cooldown por último envío
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.lastOtpSentAt) {
      const deltaMs = Date.now() - existing.lastOtpSentAt.getTime();
      const cooldownMs = this.OTP_COOLDOWN_SECONDS * 1000;
      if (deltaMs < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - deltaMs) / 1000);
        this.logger.debug(`OTP throttled ${phone} (${remainingSeconds}s rem)`);
        return {
          ok: true,
          throttled: true,
          remainingSeconds,
          phoneMasked: this.maskPhone(phone),
          cooldownSeconds: this.OTP_COOLDOWN_SECONDS,
          expiresInSeconds: this.OTP_TTL_SECONDS,
        };
      }
    }

    const code = this.generate6();
    const otpCodeHash = await bcrypt.hash(code, 10);
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + this.OTP_TTL_SECONDS * 1000);

    await this.prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        role: Role.USER,
        name: 'Usuario',
        isPhoneVerified: false,
        isEmailVerified: false,
        otpCodeHash,
        otpExpiresAt,
        lastOtpSentAt: now,
      },
      update: {
        otpCodeHash,
        otpExpiresAt,
        lastOtpSentAt: now,
      },
    });

    await this.trySendOtp(phone, code);

    if (isDevEcho) this.logger.log(`[DEV-OTP] phone=${phone} code=${code}`);

    return {
      ok: true,
      phoneMasked: this.maskPhone(phone),
      cooldownSeconds: this.OTP_COOLDOWN_SECONDS,
      expiresInSeconds: this.OTP_TTL_SECONDS,
      ...(isDevEcho ? { devOtp: code } : {}),
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{
    access_token: string;
    user: Pick<
      User,
      'id' | 'name' | 'email' | 'phone' | 'role' | 'isEmailVerified' | 'isPhoneVerified'
    >;
  }> {
    let phone = '';
    if (dto.phone) {
      phone = this.normalizePhone(dto.phone);
    } else if (dto.email) {
      const email = this.normalizeEmail(dto.email);
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (!byEmail?.phone)
        throw new BadRequestException('No hay teléfono asociado al correo');
      phone = this.normalizePhone(byEmail.phone);
    } else {
      throw new BadRequestException('Debes enviar phone o email');
    }

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.otpCodeHash || !user.otpExpiresAt) {
      throw new UnauthorizedException('OTP inválido o expirado');
    }
    if (user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expirado');
    }

    const ok = await bcrypt.compare(dto.code, user.otpCodeHash);
    if (!ok) throw new UnauthorizedException('OTP inválido');

    const updateData: any = {
      isPhoneVerified: true,
      otpCodeHash: null,
      otpExpiresAt: null,
    };

    // Guardar nombre si llegó y el usuario no lo tenía
    if (dto.name && !user.name) updateData.name = dto.name.trim();

    // Enrolar email opcional (si vino en verifyOtp)
    if (dto.emailEnroll) {
      const email = this.normalizeEmail(dto.emailEnroll);
      if (email && email !== user.email) {
        const taken = await this.prisma.user.findUnique({ where: { email } });
        if (taken) throw new BadRequestException('Ese correo ya está en uso');
        updateData.email = email;
        updateData.isEmailVerified = false;
        await this.enqueueEmailVerificationToken(user.id);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    const token = await this.signToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
    });
    return { ...token, user: updated };
  }

  async verifyEmail(token: string): Promise<{ ok: true }> {
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  // ========== Enrolar email (usado por /auth/enroll-email y/o /users/me) ==========

  async enrollEmail(userId: number, rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);
    if (!email) throw new BadRequestException('Email requerido');

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists && exists.id !== userId) {
      throw new BadRequestException('Ese correo ya está en uso');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { email, isEmailVerified: false },
    });

    // opcional: generar token de verificación
    await this.enqueueEmailVerificationToken(userId);

    return { ok: true, email };
  }

  // ========== Legacy (compat email+password) ==========

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user || !user.password)
      throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return {
      id: user.id,
      email: user.email!,
      name: user.name,
      role: user.role as Role,
    };
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email ya registrado');

    const password = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        password,
        phone: dto.phone ? this.normalizePhone(dto.phone) : undefined,
        role: Role.USER,
        isPhoneVerified: false,
        isEmailVerified: false,
      },
    });

    return this.signToken({
      id: created.id,
      email: created.email,
      role: created.role as Role,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    return this.signToken(user);
  }
}
