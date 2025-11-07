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
exports.FeedController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const feed_service_1 = require("./feed.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let FeedController = class FeedController {
    constructor(feedService) {
        this.feedService = feedService;
    }
    async getFeed(user, previewUrl, adminToken) {
        const canPreview = previewUrl && adminToken && adminToken === process.env.FEED_ADMIN_TOKEN
            ? previewUrl
            : undefined;
        return this.feedService.getFeedForUser({
            role: user?.role ?? 'B2C',
            businessVerificationStatus: user?.businessVerificationStatus ?? 'NONE',
        }, { previewUrl: canPreview });
    }
    purge(token) {
        if (token !== process.env.FEED_ADMIN_TOKEN) {
            throw new common_1.ForbiddenException();
        }
        this.feedService.purge();
    }
};
exports.FeedController = FeedController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('previewUrl')),
    __param(2, (0, common_1.Headers)('x-admin-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], FeedController.prototype, "getFeed", null);
__decorate([
    (0, common_1.Post)('_purge') // ✅ /feed/_purge
    ,
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Headers)('x-admin-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "purge", null);
exports.FeedController = FeedController = __decorate([
    (0, swagger_1.ApiTags)('feed'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('feed') // ✅ ruta base: /feed
    ,
    __metadata("design:paramtypes", [feed_service_1.FeedService])
], FeedController);
//# sourceMappingURL=feed.controller.js.map