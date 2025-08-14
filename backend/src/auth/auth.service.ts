import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

//type Role = 'ADMIN' | 'CLIENTE';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private signToken(userId: number, role: Role) {
    return this.jwt.sign({ sub: userId, role });
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email ya registrado');

    const password = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password,
        phone: dto.phone,
        role: 'CLIENTE',
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const token = this.signToken(user.id, user.role as Role);
    return { userId: user.id, name: user.name, email: user.email, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, password: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const token = this.signToken(user.id, user.role as Role);
    return { userId: user.id, name: user.name, email: user.email, token };
  }
}
