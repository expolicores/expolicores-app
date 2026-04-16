import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessVerificationStatus,
  AdminProcessStatus,
  Role,
} from '@prisma/client';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async apply(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    // si ya está aprobado, no reabrimos
    if (user.businessVerificationStatus === BusinessVerificationStatus.APPROVED) {
      return { ok: true, alreadyApproved: true };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        businessVerificationStatus: BusinessVerificationStatus.SUBMITTED,
        adminProcessStatus: AdminProcessStatus.PENDING,
        // el rol solo cambia al aprobar
      },
      select: { id: true },
    });

    return { ok: true };
  }

  async listApplications(params: { verification?: BusinessVerificationStatus[] }) {
    const where: any = {};
    if (params.verification?.length) {
      where.businessVerificationStatus = { in: params.verification };
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        businessVerificationStatus: true,
        adminProcessStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async setVerification(userId: number, status: BusinessVerificationStatus) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!current) throw new BadRequestException('Usuario no encontrado');

    const data: any = { businessVerificationStatus: status };

    if (current.role !== Role.ADMIN) {
      if (status === BusinessVerificationStatus.APPROVED) {
        data.role = Role.B2B; // ascenso efectivo
      } else if (status === BusinessVerificationStatus.REJECTED) {
        data.role = Role.B2C; // permanece/revierte a B2C
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        role: true,
        businessVerificationStatus: true,
      },
    });
  }

  async setAdminProcess(userId: number, status: AdminProcessStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { adminProcessStatus: status },
      select: { id: true, adminProcessStatus: true },
    });
  }
}
