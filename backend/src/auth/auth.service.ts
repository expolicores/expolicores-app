// backend/src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

import { Role, User } from '@prisma/client';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { SmsService } from '../notifications/sms.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ===== Config OTP (vía .env) =====
  private readonly OTP_DIGITS = parseInt(process.env.OTP_LENGTH ?? '', 10) || 6;
  private readonly OTP_TTL_MIN =
    parseInt(process.env.OTP_TTL_MIN ?? '', 10) ||
    Math.ceil((parseInt(process.env.OTP_TTL_SECONDS ?? '', 10) || 600) / 60); // compat con OTP_TTL_SECONDS
  private readonly OTP_MIN_INTERVAL_SEC =
    parseInt(process.env.OTP_MIN_INTERVAL_SEC ?? '', 10) ||
    parseInt(process.env.OTP_COOLDOWN_SECONDS ?? '', 10) ||
    45;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService,
  ) {}

  // ========== Helpers de normalización ==========
  public normalizeEmail(email?: string | null) {
    return String(email ?? '').trim().toLowerCase();
  }

  /** Normaliza a +57... en E.164 desde formatos comunes. */
  public normalizePhone(raw?: string | null) {
    const s = String(raw ?? '').replace(/[^\d+]/g, '');
    if (!s) return '';
    if (s.startsWith('+')) return s;
    const digits = s.replace(/^0+/, '');
    if (digits.startsWith('57')) return `+${digits}`;
    return `+57${digits}`;
  }

  // ========== OTP helpers ==========
  private generateOtp(): string {
    const min = Math.pow(10, this.OTP_DIGITS - 1);
    const max = Math.pow(10, this.OTP_DIGITS) - 1;
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    return String(n);
  }

  /** Devuelve "salt:hash" (sha256) para guardar en otpCodeHash. */
  private hashOtpSha(otp: string) {
    const salt = randomBytes(8).toString('hex');
    const hash = createHash('sha256').update(`${salt}:${otp}`).digest('hex');
    return `${salt}:${hash}`;
  }

  /** Verifica un OTP con compatibilidad: "salt:hash" (sha256) o bcrypt legacy. */
  private async verifyOtpHash(candidate: string, stored: string): Promise<boolean> {
    if (stored.includes(':')) {
      const [salt, hash] = stored.split(':');
      const cand = createHash('sha256').update(`${salt}:${candidate}`).digest('hex');
      return cand === hash;
    }
    // Legacy bcrypt
    try {
      return await bcrypt.compare(candidate, stored);
    } catch {
      return false;
    }
  }

  /** Firma JWT — público para uso desde controller. */
  public async signToken(user: { id: number; email?: string | null; role: Role }) {
    const payload = { sub: user.id, email: user.email ?? '', role: user.role };
    const access_token = await this.jwt.signAsync(payload, { expiresIn: '7d' });
    return { access_token };
  }

  // ===== Selección de canal (WA/SMS) =====
  private chooseOtpChannel(prefer?: 'whatsapp' | 'sms'): 'whatsapp' | 'sms' {
    const allowSms = (process.env.FEATURE_SMS_OTP ?? 'false') === 'true';
    const canUseWa =
      (process.env.FEATURE_WHATSAPP_NOTIFICATIONS ?? 'false') === 'true' &&
      (process.env.SEND_WHATSAPP_NOTIFS ?? 'false') === 'true';

    const defaultChoice = canUseWa ? 'whatsapp' : (allowSms ? 'sms' : 'whatsapp');
    if (prefer === 'sms' && allowSms) return 'sms';
    return defaultChoice;
  }

  /** Envío de OTP según canal (WA por plantilla/fallback o SMS). */
  private async trySendOtp(
    toPhoneE164: string,
    code: string,
    prefer?: 'whatsapp' | 'sms',
  ) {
    const channel = this.chooseOtpChannel(prefer);

    if (channel === 'sms') {
      try {
        await this.sms.sendOtp(toPhoneE164, code, this.OTP_TTL_MIN);
        return { channel: 'sms' as const };
      } catch (e: any) {
        // Fallback a WhatsApp si SMS falla y WA está activo
        this.logger.warn(`SMS OTP failed (${e?.message}). Trying WhatsApp fallback…`);
        const waOn =
          (process.env.FEATURE_WHATSAPP_NOTIFICATIONS ?? 'false') === 'true' &&
          (process.env.SEND_WHATSAPP_NOTIFS ?? 'false') === 'true';
        if (!waOn) throw e;
        await this.whatsapp.sendOtp(toPhoneE164, code, this.OTP_TTL_MIN);
        return { channel: 'whatsapp' as const, fallback: 'from-sms' as const };
      }
    }

    // default: WhatsApp
    await this.whatsapp.sendOtp(toPhoneE164, code, this.OTP_TTL_MIN);
    return { channel: 'whatsapp' as const };
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

    // Throttling por último envío
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.lastOtpSentAt) {
      const deltaSec = Math.floor((Date.now() - existing.lastOtpSentAt.getTime()) / 1000);
      if (deltaSec < this.OTP_MIN_INTERVAL_SEC) {
        const remainingSeconds = this.OTP_MIN_INTERVAL_SEC - deltaSec;
        this.logger.debug(`OTP throttled ${phone} (${remainingSeconds}s rem)`);
        return {
          ok: true,
          throttled: true,
          remainingSeconds,
          phoneMasked: this.maskPhone(phone),
          cooldownSeconds: this.OTP_MIN_INTERVAL_SEC,
          expiresInSeconds: this.OTP_TTL_MIN * 60,
        };
      }
    }

    // Generar y almacenar OTP (salt:hash)
    const code = this.generateOtp();
    const otpCodeHash = this.hashOtpSha(code);
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + this.OTP_TTL_MIN * 60 * 1000);

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

    // Enviar por canal seleccionado (respetando dto.channel si procede)
    await this.trySendOtp(phone, code, dto.channel);

    if (isDevEcho) this.logger.log(`[DEV-OTP] phone=${phone} code=${code}`);

    return {
      ok: true,
      phoneMasked: this.maskPhone(phone),
      cooldownSeconds: this.OTP_MIN_INTERVAL_SEC,
      expiresInSeconds: this.OTP_TTL_MIN * 60,
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

    const ok = await this.verifyOtpHash(dto.code, user.otpCodeHash);
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
