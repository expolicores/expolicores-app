"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfOrAdminGuard = void 0;
const common_1 = require("@nestjs/common");
let SelfOrAdminGuard = class SelfOrAdminGuard {
    canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        const paramId = Number(req.params?.id);
        if (!user)
            return false;
        if (user.role === 'ADMIN')
            return true;
        if (!Number.isNaN(paramId) && user.id === paramId)
            return true;
        return false;
    }
};
exports.SelfOrAdminGuard = SelfOrAdminGuard;
exports.SelfOrAdminGuard = SelfOrAdminGuard = __decorate([
    (0, common_1.Injectable)()
], SelfOrAdminGuard);
//# sourceMappingURL=self-or-admin.guard.js.map