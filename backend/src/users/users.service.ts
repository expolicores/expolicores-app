import { Injectable, NotFoundException /*, BadRequestException */ } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './update-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Nunca devolvemos el hash de password
  private readonly safeUserSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async findAll() {
    return this.prisma.user.findMany({ select: this.safeUserSelect });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Actualización de datos del propio usuario (o admin sobre cualquier id)
  async updateSelf(id: number, dto: UpdateUserDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.password !== undefined) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: this.safeUserSelect,
    });
    return user;
  }

  // Cambiar rol (solo ADMIN)
  async updateRole(id: number, role: Role) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: this.safeUserSelect,
    });
    return user;
  }

  async remove(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  /* (Opcional) Crear usuarios desde ADMIN
  async createByAdmin(dto: { name: string; email: string; phone: string; password: string; role?: Role }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email ya registrado');
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, phone: dto.phone, password, role: dto.role ?? 'CLIENTE' },
      select: this.safeUserSelect,
    });
    return user;
  }
  */
}
