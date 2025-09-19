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
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Registro: deja el comportamiento que definas en el servicio (crear usuario y/o devolver token)
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // Login: valida credenciales y devuelve { access_token }
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    // IMPORTANTE: validateUser debe lanzar UnauthorizedException cuando falle
    const user = await this.auth.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // signToken debe devolver { access_token }
    return this.auth.signToken(user);
  }

  // Perfil del portador del token
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    // Devuelve la vista “segura” del usuario que pusiste en el payload (id, email, role, name, etc.)
    return user;
  }
}
