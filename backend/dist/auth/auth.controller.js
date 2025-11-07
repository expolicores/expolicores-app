"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
// backend/src/auth/auth.controller.ts
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
// Legacy (compat) email/password
const register_dto_1 = require("./dto/register.dto");
const login_dto_1 = require("./dto/login.dto");
// JWT guard + user decorator
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const current_user_decorator_1 = require("./decorators/current-user.decorator");
// OTP-first + verificación de email
const request_otp_dto_1 = require("./dto/request-otp.dto");
const verify_otp_dto_1 = require("./dto/verify-otp.dto");
const verify_email_dto_1 = require("./dto/verify-email.dto");
const enroll_email_dto_1 = require("./dto/enroll-email.dto");
let AuthController = class AuthController {
    constructor(auth) {
        this.auth = auth;
    }
    /**
     * Registro (legado/puente) por email+password.
     * La estrategia principal es OTP por celular; esto se mantiene por compatibilidad.
     */
    async register(dto) {
        return this.auth.register(dto);
    }
    /**
     * Login (legado/puente) por email+password -> { access_token }.
     */
    async login(dto) {
        const user = await this.auth.validateUser(dto.email, dto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        return this.auth.signToken(user);
    }
    /**
     * OTP-first: solicitar OTP
     * - Si llega phone: envía OTP (WhatsApp/SMS según flags).
     * - Si llega email: busca el usuario y envía OTP al phone verificado asociado.
     * Respuesta incluye flags útiles para UI (p.ej., throttling, devOtp en DEV, etc).
     */
    async requestOtp(dto) {
        return this.auth.requestOtp(dto);
    }
    /**
     * OTP-first: verificar OTP
     * - phone + code (o email + code cuando se inició por email).
     * - Opcionalmente puede venir name y/o emailEnroll para completar onboarding.
     * Devuelve { access_token, user }.
     */
    async verifyOtp(dto) {
        return this.auth.verifyOtp(dto);
    }
    /**
     * Verificación de email por token (enlace enviado al correo).
     * Marca isEmailVerified=true si el token es válido.
     */
    async verifyEmail(dto) {
        return this.auth.verifyEmail(dto.token);
    }
    async enrollEmail(me, dto) {
        return this.auth.enrollEmail(me.id, dto.normalized);
    }
    /**
     * Perfil del usuario autenticado (JWT).
     * Devuelve la vista segura del usuario adjunta por JwtStrategy en req.user.
     */
    me(user) {
        return user;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('request-otp'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_otp_dto_1.RequestOtpDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "requestOtp", null);
__decorate([
    (0, common_1.Post)('verify-otp'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyOtp", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_dto_1.VerifyEmailDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('enroll-email'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, enroll_email_dto_1.EnrollEmailDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "enrollEmail", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map