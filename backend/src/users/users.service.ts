// backend/src/users/users.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type UpdateMeInput = {
  name?: string;
  email?: string | null;
  /** Alias que puede venir del front; si viene y no hay `email`, se usa este. */
  emailEnroll?: string | null;
  /** Cambiar phone desde aquí NO verifica OTP. Si se cambia, se marca isPhoneVerified=false. */
  phone?: string | null;
  password?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Proyección segura: nunca devolvemos password ni campos sensibles */
  private readonly safeUserSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    isEmailVerified: true,
    isPhoneVerified: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  // ===== Helpers =====
  private normalizeEmail(email?: string | null) {
    const s = String(email ?? '').trim().toLowerCase();
    return s.length ? s : null;
  }

  /** Normaliza a E.164 CO (+57...). Acepta “+57…”, “57…”, “03…”, “3…”. */
  private normalizePhone(raw?: string | null) {
    const v = String(raw ?? '').trim();
    if (!v) return null;
    if (v.startsWith('+')) return v;
    const digits = v.replace(/\D/g, '').replace(/^0+/, '');
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    return `+${withCountry}`;
  }

  // ===== Lectura =====
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

  /** Versión pública/segura por id (para /users/me) */
  async findPublicById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ===== Escritura (perfil propio) =====
  /**
   * Actualiza el propio perfil del usuario autenticado.
   * - `name`: texto (min 2).
   * - `email` o `emailEnroll`: normaliza y garantiza unicidad; marca isEmailVerified=false.
   * - `phone`: **opcional**; si cambia, normaliza a E.164 y marca isPhoneVerified=false.
   * - `password`: compat (hash).
   *
   * Nota: la verificación OTP de teléfono NO se hace aquí.
   */
  async updateMe(userId: number, data: UpdateMeInput) {
    const patch: any = {};

    // name
    if (typeof data.name === 'string') {
      const name = data.name.trim();
      if (name.length < 2) throw new BadRequestException('Nombre demasiado corto.');
      patch.name = name;
    }

    // Resolver fuente de email: `email` tiene prioridad; si no, `emailEnroll`
    const incomingEmailRaw =
      data.email !== undefined ? data.email : data.emailEnroll;

    if (incomingEmailRaw !== undefined) {
      const email = this.normalizeEmail(incomingEmailRaw);
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      // Si realmente cambia el email…
      if ((current?.email ?? null) !== (email ?? null)) {
        if (email) {
          const exists = await this.prisma.user.findUnique({ where: { email } });
          if (exists && exists.id !== userId) {
            throw new BadRequestException('Ese correo ya está en uso.');
          }
        }
        patch.email = email; // puede ser null para limpiar
        patch.isEmailVerified = false;
        // TODO: opcional — generar token y enviar verificación por correo
      }
    }

    // phone — si decides permitirlo desde perfil (sin OTP). Se marca como no verificado.
    if (data.phone !== undefined) {
      const newPhone = this.normalizePhone(data.phone);
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });

      if ((current?.phone ?? null) !== (newPhone ?? null)) {
        if (newPhone) {
          // Chequear unicidad si hay índice único condicional en phone
          const clash = await this.prisma.user.findUnique({
            where: { phone: newPhone },
          });
          if (clash && clash.id !== userId) {
            throw new BadRequestException('Ese teléfono ya está asociado a otra cuenta.');
          }
        }
        patch.phone = newPhone; // puede ser null para limpiar
        patch.isPhoneVerified = false;
      }
    }

    // password (compat)
    if (data.password) {
      if (String(data.password).length < 8) {
        throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
      }
      patch.password = await bcrypt.hash(String(data.password), 10);
    }

    if (Object.keys(patch).length === 0) {
      return this.findPublicById(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: patch,
    });

    return this.findPublicById(userId);
  }

  /**
   * Compat: algunos controladores antiguos llamaban updateSelf.
   * Redirige a updateMe.
   */
  async updateSelf(id: number, dto: UpdateMeInput) {
    return this.updateMe(id, dto);
  }

  // ===== Admin =====
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
  async createByAdmin(dto: {
    name: string;
    email?: string | null;
    phone?: string | null;
    password?: string | null;
    role?: Role;
  }) {
    const email = this.normalizeEmail(dto.email);
    if (email) {
      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists) throw new BadRequestException('Email ya registrado');
    }
    const phone = this.normalizePhone(dto.phone);
    if (phone) {
      const clash = await this.prisma.user.findUnique({ where: { phone } });
      if (clash) throw new BadRequestException('Teléfono ya registrado');
    }
    const password = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        phone,
        password,
        role: dto.role ?? ('USER' as Role),
        isEmailVerified: false,
        isPhoneVerified: !!phone && false,
      },
      select: this.safeUserSelect,
    });
    return user;
  }
  */
}
