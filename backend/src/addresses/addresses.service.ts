import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createForUser(userId: number, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      const makeDefault = dto.isDefault === true || count === 0;

      if (makeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      return tx.address.create({
        data: {
          userId,
          ...dto,
          isDefault: makeDefault,
        },
      });
    });
  }

  private async ensureOwnerOrAdmin(addressId: number, userId: number, role: 'ADMIN' | 'CLIENTE') {
    const addr = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!addr) throw new NotFoundException('Address not found');
    if (addr.userId !== userId && role !== 'ADMIN') throw new ForbiddenException();
    return addr;
  }

  async update(addressId: number, userId: number, role: 'ADMIN' | 'CLIENTE', dto: UpdateAddressDto) {
    await this.ensureOwnerOrAdmin(addressId, userId, role);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: { ...dto },
      });
    });
  }

  async remove(addressId: number, userId: number, role: 'ADMIN' | 'CLIENTE') {
    await this.ensureOwnerOrAdmin(addressId, userId, role);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { deleted: true };
  }
}
