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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AddressesService = class AddressesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    listMine(userId) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });
    }
    async createForUser(userId, dto) {
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
    async ensureOwnerOrAdmin(addressId, userId, role) {
        const addr = await this.prisma.address.findUnique({ where: { id: addressId } });
        if (!addr)
            throw new common_1.NotFoundException('Address not found');
        if (addr.userId !== userId && role !== 'ADMIN')
            throw new common_1.ForbiddenException();
        return addr;
    }
    async update(addressId, userId, role, dto) {
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
    async remove(addressId, userId, role) {
        await this.ensureOwnerOrAdmin(addressId, userId, role);
        await this.prisma.address.delete({ where: { id: addressId } });
        return { deleted: true };
    }
};
exports.AddressesService = AddressesService;
exports.AddressesService = AddressesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AddressesService);
//# sourceMappingURL=addresses.service.js.map