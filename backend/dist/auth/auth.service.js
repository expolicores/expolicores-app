"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// backend/src/auth/auth.service.ts
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const whatsapp_service_1 = require("../notifications/whatsapp.service");
const sms_service_1 = require("../notifications/sms.service");
let AuthService = AuthService_1 = class AuthService {
    // Nota: DEV_OTP_FIXED no se usa para cambiar el código guardado; siempre devolvemos el real para que verifique contra DB.
    constructor(prisma, jwt, whatsapp, sms) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.whatsapp = whatsapp;
        this.sms = sms;
        this.logger = new common_1.Logger(AuthService_1.name);
        // ===== Config OTP (vía .env) =====
        this.OTP_DIGITS = parseInt(process.env.OTP_LENGTH ?? '', 10) || 6;
        this.OTP_TTL_MIN = parseInt(process.env.OTP_TTL_MIN ?? '', 10) ||
            Math.ceil((parseInt(process.env.OTP_TTL_SECONDS ?? '', 10) || 600) / 60); // compat con OTP_TTL_SECONDS
        this.OTP_MIN_INTERVAL_SEC = parseInt(process.env.OTP_MIN_INTERVAL_SEC ?? '', 10) ||
            parseInt(process.env.OTP_COOLDOWN_SECONDS ?? '', 10) ||
            45;
        // Flags de canal (sin fallback entre canales)
        this.FEATURE_SMS_OTP = (process.env.FEATURE_SMS_OTP ?? 'false') === 'true';
        this.FEATURE_WA_OTP = (process.env.FEATURE_WHATSAPP_NOTIFICATIONS ?? 'false') === 'true' &&
            (process.env.SEND_WHATSAPP_NOTIFS ?? 'false') === 'true';
        // Fallback de QA (devOtp)
        this.FEATURE_DEV_OTP = (process.env.FEATURE_DEV_OTP ?? 'false') === 'true';
        this.ALLOWED_DEV_OTP_PHONES = (process.env.ALLOWED_DEV_OTP_PHONES ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    // ========== Helpers de normalización ==========
    normalizeEmail(email) {
        return String(email ?? '').trim().toLowerCase();
    }
    /** Normaliza a +57... en E.164 desde formatos comunes. */
    normalizePhone(raw) {
        const s = String(raw ?? '').replace(/[^\d+]/g, '');
        if (!s)
            return '';
        if (s.startsWith('+'))
            return s;
        const digits = s.replace(/^0+/, '');
        if (digits.startsWith('57'))
            return `+${digits}`;
        return `+57${digits}`;
    }
    // ========== OTP helpers ==========
    generateOtp() {
        const min = Math.pow(10, this.OTP_DIGITS - 1);
        const max = Math.pow(10, this.OTP_DIGITS) - 1;
        const n = Math.floor(Math.random() * (max - min + 1)) + min;
        return String(n);
    }
    /** Devuelve "salt:hash" (sha256) para guardar en otpCodeHash. */
    hashOtpSha(otp) {
        const salt = (0, crypto_1.randomBytes)(8).toString('hex');
        const hash = (0, crypto_1.createHash)('sha256').update(`${salt}:${otp}`).digest('hex');
        return `${salt}:${hash}`;
    }
    /** Verifica un OTP con compatibilidad: "salt:hash" (sha256) o bcrypt legacy. */
    async verifyOtpHash(candidate, stored) {
        if (stored.includes(':')) {
            const [salt, hash] = stored.split(':');
            const cand = (0, crypto_1.createHash)('sha256').update(`${salt}:${candidate}`).digest('hex');
            return cand === hash;
        }
        // Legacy bcrypt
        try {
            return await bcrypt.compare(candidate, stored);
        }
        catch {
            return false;
        }
    }
    /** Firma JWT — público para uso desde controller. */
    async signToken(user) {
        const payload = { sub: user.id, email: user.email ?? '', role: user.role };
        const access_token = await this.jwt.signAsync(payload, { expiresIn: '7d' });
        return { access_token };
    }
    // ===== Envío de OTP (SIN fallback entre canales) =====
    ensureChannelAllowed(channel) {
        if (channel === 'sms' && !this.FEATURE_SMS_OTP) {
            throw new common_1.BadRequestException('Canal SMS deshabilitado');
        }
        if (channel === 'whatsapp' && !this.FEATURE_WA_OTP) {
            throw new common_1.BadRequestException('Canal WhatsApp deshabilitado');
        }
    }
    /** Envío de OTP exactamente por el canal solicitado. Sin fallback. */
    async sendOtpExact(toPhoneE164, code, channel) {
        this.ensureChannelAllowed(channel);
        if (channel === 'sms') {
            await this.sms.sendOtp(toPhoneE164, code, this.OTP_TTL_MIN);
            return { channel: 'sms' };
        }
        await this.whatsapp.sendOtp(toPhoneE164, code, this.OTP_TTL_MIN);
        return { channel: 'whatsapp' };
    }
    /** Genera y persiste token para verificación de email. */
    async enqueueEmailVerificationToken(userId) {
        const token = (0, crypto_1.randomBytes)(24).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.prisma.emailVerificationToken.create({
            data: { userId, token, expiresAt },
        });
        return token;
    }
    maskPhone(p) {
        const digits = p.replace(/\D/g, '');
        if (digits.length < 6)
            return p;
        const tail = digits.slice(-4);
        return `+57*****${tail}`;
    }
    // ========== OTP-first ==========
    async requestOtp(dto) {
        const isDevEcho = process.env.NODE_ENV !== 'production' ||
            process.env.LOG_OTP_DEV === 'true';
        // Validar canal explícito (sin fallback)
        const channel = (dto.channel ?? '').toLowerCase();
        if (channel !== 'whatsapp' && channel !== 'sms') {
            throw new common_1.BadRequestException('Canal inválido (whatsapp|sms)');
        }
        this.ensureChannelAllowed(channel);
        let phone = '';
        if (dto.phone) {
            phone = this.normalizePhone(dto.phone);
        }
        else if (dto.email) {
            const email = this.normalizeEmail(dto.email);
            const user = await this.prisma.user.findUnique({ where: { email } });
            if (!user || !user.phone || !user.isPhoneVerified) {
                throw new common_1.BadRequestException('No hay teléfono verificado asociado a ese correo');
            }
            phone = this.normalizePhone(user.phone);
        }
        else {
            throw new common_1.BadRequestException('Debes enviar phone o email');
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
                role: client_1.Role.B2C, // rol por defecto retail
                name: 'Cliente',
                isPhoneVerified: false,
                isEmailVerified: false,
                // Estados B2B default (no solicitados)
                businessVerificationStatus: client_1.BusinessVerificationStatus.NONE,
                adminProcessStatus: client_1.AdminProcessStatus.PENDING,
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
        let devOtpToReturn;
        try {
            await this.sendOtpExact(phone, code, channel);
            if (isDevEcho) {
                this.logger.log(`[DEV-OTP] phone=${phone} code=${code} via=${channel}`);
            }
        }
        catch (e) {
            // Registro detallado para ver exactamente qué responde el proveedor (Twilio u otro)
            this.logger.error(`OTP delivery FAIL phone=${phone} via=${channel} code=${e?.code ?? 'n/a'} status=${e?.status ?? 'n/a'} more=${e?.moreInfo ?? 'n/a'} msg=${e?.message ?? e}`);
            // Fallback QA: si FEATURE_DEV_OTP=true y el número está permitido (o la lista está vacía → permitir todos)
            const allowAll = this.ALLOWED_DEV_OTP_PHONES.length === 0;
            const isAllowed = allowAll || this.ALLOWED_DEV_OTP_PHONES.includes(phone);
            if (this.FEATURE_DEV_OTP && isAllowed) {
                this.logger.warn(`Fallback a devOtp para ${phone} (FEATURE_DEV_OTP=true${allowAll ? ', allowAll' : ''})`);
                devOtpToReturn = code; // devolvemos el mismo que guardamos en DB para que verifique
            }
            else {
                // Sin fallback → error al cliente
                throw new common_1.BadRequestException('SMS_DELIVERY_FAILED');
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
    async verifyOtp(dto) {
        let phone = '';
        if (dto.phone) {
            phone = this.normalizePhone(dto.phone);
        }
        else if (dto.email) {
            const email = this.normalizeEmail(dto.email);
            const byEmail = await this.prisma.user.findUnique({ where: { email } });
            if (!byEmail?.phone)
                throw new common_1.BadRequestException('No hay teléfono asociado al correo');
            phone = this.normalizePhone(byEmail.phone);
        }
        else {
            throw new common_1.BadRequestException('Debes enviar phone o email');
        }
        const user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user || !user.otpCodeHash || !user.otpExpiresAt) {
            throw new common_1.UnauthorizedException('OTP inválido o expirado');
        }
        if (user.otpExpiresAt < new Date()) {
            throw new common_1.UnauthorizedException('OTP expirado');
        }
        const ok = await this.verifyOtpHash(dto.code, user.otpCodeHash);
        if (!ok)
            throw new common_1.UnauthorizedException('OTP inválido');
        const updateData = {
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
                    throw new common_1.BadRequestException('Ese correo ya está en uso');
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
    async verifyEmail(token) {
        const row = await this.prisma.emailVerificationToken.findUnique({
            where: { token },
        });
        if (!row || row.usedAt || row.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Token inválido o expirado');
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
    async enrollEmail(userId, rawEmail) {
        const email = this.normalizeEmail(rawEmail);
        if (!email)
            throw new common_1.BadRequestException('Email requerido');
        const exists = await this.prisma.user.findUnique({ where: { email } });
        if (exists && exists.id !== userId) {
            throw new common_1.BadRequestException('Ese correo ya está en uso');
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
    async validateUser(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email: this.normalizeEmail(email) },
        });
        if (!user || !user.password)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        const ok = await bcrypt.compare(password, user.password);
        if (!ok)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    }
    async register(dto) {
        const email = this.normalizeEmail(dto.email);
        const exists = await this.prisma.user.findUnique({ where: { email } });
        if (exists)
            throw new common_1.BadRequestException('Email ya registrado');
        const password = await bcrypt.hash(dto.password, 10);
        const created = await this.prisma.user.create({
            data: {
                name: dto.name || 'Cliente',
                email,
                password,
                phone: dto.phone ? this.normalizePhone(dto.phone) : undefined,
                role: client_1.Role.B2C, // por defecto retail
                isPhoneVerified: false,
                isEmailVerified: false,
                businessVerificationStatus: client_1.BusinessVerificationStatus.NONE,
                adminProcessStatus: client_1.AdminProcessStatus.PENDING,
            },
        });
        return this.signToken({
            id: created.id,
            email: created.email,
            role: created.role,
        });
    }
    async login(dto) {
        const user = await this.validateUser(dto.email, dto.password);
        return this.signToken(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        whatsapp_service_1.WhatsAppService,
        sms_service_1.SmsService])
], AuthService);
//# sourceMappingURL=auth.service.js.map