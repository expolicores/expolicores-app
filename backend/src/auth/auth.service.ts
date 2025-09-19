import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs'; // 👈 usa bcryptjs (evita binarios nativos)
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return String(email ?? '').trim().toLowerCase();
  }

  /** Valida credenciales y devuelve una vista segura del usuario */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
  }

  /** Firma y devuelve { access_token } */
  async signToken(user: { id: number; email: string; role: Role }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwt.signAsync(payload, { expiresIn: '7d' });
    return { access_token };
  }

  /** Registro y retorno de token consistente */
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
        phone: dto.phone,
        role: 'CLIENTE',
      },
    });

    const user = { id: created.id, email: created.email, role: created.role as Role };
    return this.signToken(user); // -> { access_token }
  }

  /** Compatibilidad si el controlador aún llama login(dto) */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    return this.signToken(user); // -> { access_token }
  }
}
