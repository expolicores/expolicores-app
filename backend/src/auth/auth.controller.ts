// backend/src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';

// Legacy (compat) email/password
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// JWT guard + user decorator
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

// OTP-first + verificación de email
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EnrollEmailDto } from './dto/enroll-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Registro (legado/puente) por email+password.
   * La estrategia principal es OTP por celular; esto se mantiene por compatibilidad.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /**
   * Login (legado/puente) por email+password -> { access_token }.
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.auth.signToken(user);
  }

  /**
   * OTP-first: solicitar OTP
   * - Si llega phone: envía OTP (WhatsApp/SMS según flags).
   * - Si llega email: busca el usuario y envía OTP al phone verificado asociado.
   * Respuesta incluye flags útiles para UI (p.ej., throttling, devOtp en DEV, etc).
   */
  @Post('request-otp')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  /**
   * OTP-first: verificar OTP
   * - phone + code (o email + code cuando se inició por email).
   * - Opcionalmente puede venir name y/o emailEnroll para completar onboarding.
   * Devuelve { access_token, user }.
   */
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  /**
   * Verificación de email por token (enlace enviado al correo).
   * Marca isEmailVerified=true si el token es válido.
   */
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('enroll-email')
  async enrollEmail(@CurrentUser() me: any, @Body() dto: EnrollEmailDto) {
  return this.auth.enrollEmail(me.id, dto.normalized);
  }

  /**
   * Perfil del usuario autenticado (JWT).
   * Devuelve la vista segura del usuario adjunta por JwtStrategy en req.user.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user;
  }
}
