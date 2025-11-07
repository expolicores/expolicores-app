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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBusinessController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/guards/roles.guard");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const business_service_1 = require("./business.service");
const update_verification_dto_1 = require("./dto/update-verification.dto");
const update_admin_process_dto_1 = require("./dto/update-admin-process.dto");
const client_1 = require("@prisma/client");
let AdminBusinessController = class AdminBusinessController {
    constructor(service) {
        this.service = service;
    }
    async list(status) {
        const verification = status
            ? status.split(',').map((s) => s.trim().toUpperCase())
            : undefined;
        return this.service.listApplications({ verification });
    }
    async setVerification(userId, dto) {
        return this.service.setVerification(userId, dto.status);
    }
    async setAdminProcess(userId, dto) {
        return this.service.setAdminProcess(userId, dto.status);
    }
};
exports.AdminBusinessController = AdminBusinessController;
__decorate([
    (0, common_1.Get)('applications'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminBusinessController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':userId/verification'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_verification_dto_1.UpdateVerificationDto]),
    __metadata("design:returntype", Promise)
], AdminBusinessController.prototype, "setVerification", null);
__decorate([
    (0, common_1.Patch)(':userId/admin-process'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_admin_process_dto_1.UpdateAdminProcessDto]),
    __metadata("design:returntype", Promise)
], AdminBusinessController.prototype, "setAdminProcess", null);
exports.AdminBusinessController = AdminBusinessController = __decorate([
    (0, common_1.Controller)('admin/business'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [business_service_1.BusinessService])
], AdminBusinessController);
//# sourceMappingURL=business.admin.controller.js.map