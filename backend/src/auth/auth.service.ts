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

import {
  Role,
  User,
  BusinessVerificationStatus,
  AdminProcessStatus,
} from '@prisma/client';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { SmsService } from '../notifications/sms.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ===== Config OTP (vía .env) =====
  private readonly OTP_DIGITS =
    parseInt(process.env.OTP_LENGTH ?? '', 10) || 6;

  private readonly OTP_TTL_MIN =
    parseInt(process.env.OTP_TTL_MIN ?? '', 10) ||
    Math.ceil(
      (parseInt(process.env.OTP_TTL_SECONDS ?? '', 10) || 600) / 60,
    ); // compat con OTP_TTL_SECONDS

  private readonly OTP_MIN_INTERVAL_SEC =
    parseInt(process.env.OTP_MIN_INTERVAL_SEC ?? '', 10) ||
    parseInt(process.env.OTP_COOLDOWN_SECONDS ?? '', 10) ||
    45;

  // Flags de canal (sin fallback entre canales)
  private readonly FEATURE_SMS_OTP =
    (process.env.FEATURE_SMS_OTP ?? 'false') === 'true';
  private readonly FEATURE_WA_OTP =
    (process.env.FEATURE_WHATSAPP_NOTIFICATIONS ?? 'false') === 'true' &&
    (process.env.SEND_WHATSAPP_NOTIFS ?? 'false') === 'true';

  // Fallback de QA (devOtp)
  private readonly FEATURE_DEV_OTP =
    (process.env.FEATURE_DEV_OTP ?? 'false') === 'true';
  private readonly ALLOWED_DEV_OTP_PHONES: string[] = (
    process.env.ALLOWED_DEV_OTP_PHONES ?? ''
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Nota: DEV_OTP_FIXED no se usa para cambiar el código guardado; siempre devolvemos el real para que verifique contra DB.

  // Cuenta de prueba para revisión (Google Play / App Store)
  private readonly REVIEWER_TEST_PHONE =
    process.env.REVIEWER_TEST_PHONE ?? '+573505336910';
  private readonly REVIEWER_TEST_OTP =
    process.env.REVIEWER_TEST_OTP ?? '123456';

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
    const hash = createHash('sha256')
      .update(`${salt}:${otp}`)
      .digest('hex');
    return `${salt}:${hash}`;
  }

  /** Verifica un OTP con compatibilidad: "salt:hash" (sha256) o bcrypt legacy. */
  private async verifyOtpHash(
    candidate: string,
    stored: string,
  ): Promise<boolean> {
    if (stored.includes(':')) {
      const [salt, hash] = stored.split(':');
      const cand = createHash('sha256')
        .update(`${salt}:${candidate}`)
        .digest('hex');
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
  public async signToken(user: {
    id: number;
    email?: string | null;
    role: Role;
  }) {
    const payload = { sub: user.id, email: user.email ?? '', role: user.role };
    const access_token = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });
    return { access_token };
  }

  // ===== Envío de OTP (SIN fallback entre canales) =====

  private ensureChannelAllowed(channel: 'whatsapp' | 'sms') {
    if (channel === 'sms' && !this.FEATURE_SMS_OTP) {
      throw new BadRequestException('Canal SMS deshabilitado');
    }
    if (channel === 'whatsapp' && !this.FEATURE_WA_OTP) {
      throw new BadRequestException('Canal WhatsApp deshabilitado');
    }
  }

  /** Envío de OTP exactamente por el canal solicitado. Sin fallback. */
  private async sendOtpExact(
    toPhoneE164: string,
    code: string,
    channel: 'whatsapp' | 'sms',
  ) {
    this.ensureChannelAllowed(channel);
    if (channel === 'sms') {
      await this.sms.sendOtp(toPhoneE164, code, this.OTP_TTL_MIN);
      return { channel: 'sms' as const };
    }
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

    // Validar canal explícito (sin fallback)
    const channel = (dto.channel ?? '').toLowerCase();
    if (channel !== 'whatsapp' && channel !== 'sms') {
      throw new BadRequestException('Canal inválido (whatsapp|sms)');
    }
    this.ensureChannelAllowed(channel as 'whatsapp' | 'sms');

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

    // ¿Es el teléfono de prueba para revisión?
    const reviewerPhoneNormalized = this.normalizePhone(
      this.REVIEWER_TEST_PHONE,
    );
    const isReviewerPhone = phone === reviewerPhoneNormalized;

    // Throttling por último envío
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.lastOtpSentAt) {
      const deltaSec = Math.floor(
        (Date.now() - existing.lastOtpSentAt.getTime()) / 1000,
      );
      if (deltaSec < this.OTP_MIN_INTERVAL_SEC) {
        const remainingSeconds = this.OTP_MIN_INTERVAL_SEC - deltaSec;
        this.logger.debug(
          `OTP throttled ${phone} (${remainingSeconds}s rem)`,
        );
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
    // Para el reviewer usamos siempre REVIEWER_TEST_OTP, para el resto generamos uno aleatorio
    const code = isReviewerPhone
      ? this.REVIEWER_TEST_OTP
      : this.generateOtp();
    const otpCodeHash = this.hashOtpSha(code);
    const now = new Date();
    const otpExpiresAt = new Date(
      now.getTime() + this.OTP_TTL_MIN * 60 * 1000,
    );

    await this.prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        role: Role.B2C, // rol por defecto retail
        name: 'Cliente',
        isPhoneVerified: false,
        isEmailVerified: false,
        // Estados B2B default (no solicitados)
        businessVerificationStatus: BusinessVerificationStatus.NONE,
        adminProcessStatus: AdminProcessStatus.PENDING,
        // OTP
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

    // Enviar por el canal solicitado (sin fallback) con logs de diagnóstico
    let devOtpToReturn: string | undefined;
    try {
      if (!isReviewerPhone) {
        // Usuarios normales: sí enviamos SMS/WhatsApp
        await this.sendOtpExact(phone, code, channel as 'whatsapp' | 'sms');
      } else {
        // Cuenta de revisión: no enviamos SMS, solo log
        this.logger.log(
          `[REVIEW-OTP] phone=${phone} code=${code} (no SMS sent; reviewer account)`,
        );
      }

      if (isDevEcho) {
        this.logger.log(
          `[DEV-OTP] phone=${phone} code=${code} via=${channel} reviewer=${isReviewerPhone}`,
        );
      }
    } catch (e: any) {
      // Registro detallado para ver exactamente qué responde el proveedor (Twilio u otro)
      this.logger.error(
        `OTP delivery FAIL phone=${phone} via=${channel} code=${
          e?.code ?? 'n/a'
        } status=${e?.status ?? 'n/a'} more=${e?.moreInfo ?? 'n/a'} msg=${
          e?.message ?? e
        }`,
      );

      // Fallback QA: si FEATURE_DEV_OTP=true y el número está permitido (o la lista está vacía → permitir todos)
      const allowAll = this.ALLOWED_DEV_OTP_PHONES.length === 0;
      const isAllowed =
        allowAll || this.ALLOWED_DEV_OTP_PHONES.includes(phone);
      if (this.FEATURE_DEV_OTP && isAllowed) {
        this.logger.warn(
          `Fallback a devOtp para ${phone} (FEATURE_DEV_OTP=true${
            allowAll ? ', allowAll' : ''
          })`,
        );
        devOtpToReturn = code; // devolvemos el mismo que guardamos en DB para que verifique
      } else {
        // Sin fallback → error al cliente
        throw new BadRequestException('SMS_DELIVERY_FAILED');
      }
    }

    return {
      ok: true,
      phoneMasked: this.maskPhone(phone),
      cooldownSeconds: this.OTP_MIN_INTERVAL_SEC,
      expiresInSeconds: this.OTP_TTL_MIN * 60,
      ...(isDevEcho && devOtpToReturn ? { devOtp: devOtpToReturn } : {}),
      ...(isDevEcho && !devOtpToReturn ? { devOtp: code } : {}), // si no falló, igual podemos devolver en dev
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{
    access_token: string;
    user: Pick<
      User,
      | 'id'
      | 'name'
      | 'email'
      | 'phone'
      | 'role'
      | 'isEmailVerified'
      | 'isPhoneVerified'
      | 'businessVerificationStatus'
      | 'adminProcessStatus'
    >;
  }> {
    let phone = '';
    if (dto.phone) {
      phone = this.normalizePhone(dto.phone);
    } else if (dto.email) {
      const email = this.normalizeEmail(dto.email);
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (!byEmail?.phone)
        throw new BadRequestException(
          'No hay teléfono asociado al correo',
        );
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
    if (dto.name && (!user.name || user.name === 'Cliente'))
      updateData.name = dto.name.trim();

    // Enrolar email opcional (si vino en verifyOtp)
    if (dto.emailEnroll) {
      const email = this.normalizeEmail(dto.emailEnroll);
      if (email && email !== user.email) {
        const taken = await this.prisma.user.findUnique({ where: { email } });
        if (taken)
          throw new BadRequestException('Ese correo ya está en uso');
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
        businessVerificationStatus: true,
        adminProcessStatus: true,
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
        name: dto.name || 'Cliente',
        email,
        password,
        phone: dto.phone ? this.normalizePhone(dto.phone) : undefined,
        role: Role.B2C, // por defecto retail
        isPhoneVerified: false,
        isEmailVerified: false,
        businessVerificationStatus: BusinessVerificationStatus.NONE,
        adminProcessStatus: AdminProcessStatus.PENDING,
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
