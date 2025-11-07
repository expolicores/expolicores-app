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
exports.BusinessService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let BusinessService = class BusinessService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async apply(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.BadRequestException('Usuario no encontrado');
        // si ya está aprobado, no reabrimos
        if (user.businessVerificationStatus === client_1.BusinessVerificationStatus.APPROVED) {
            return { ok: true, alreadyApproved: true };
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                businessVerificationStatus: client_1.BusinessVerificationStatus.SUBMITTED,
                adminProcessStatus: client_1.AdminProcessStatus.PENDING,
                // el rol solo cambia al aprobar
            },
            select: { id: true },
        });
        return { ok: true };
    }
    async listApplications(params) {
        const where = {};
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
    async setVerification(userId, status) {
        const current = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        if (!current)
            throw new common_1.BadRequestException('Usuario no encontrado');
        const data = { businessVerificationStatus: status };
        if (current.role !== client_1.Role.ADMIN) {
            if (status === client_1.BusinessVerificationStatus.APPROVED) {
                data.role = client_1.Role.B2B; // ascenso efectivo
            }
            else if (status === client_1.BusinessVerificationStatus.REJECTED) {
                data.role = client_1.Role.B2C; // permanece/revierte a B2C
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
    async setAdminProcess(userId, status) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { adminProcessStatus: status },
            select: { id: true, adminProcessStatus: true },
        });
    }
};
exports.BusinessService = BusinessService;
exports.BusinessService = BusinessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessService);
//# sourceMappingURL=business.service.js.map