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
var LiveActivitiesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const live_apns_1 = require("./live-apns");
let LiveActivitiesService = LiveActivitiesService_1 = class LiveActivitiesService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(LiveActivitiesService_1.name);
    }
    async register({ orderId, activityId, pushToken }) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new Error('Order not found');
        const ola = await this.prisma.orderLiveActivity.upsert({
            where: { orderId },
            update: { activityId, pushToken, userId: order.userId, isEnded: false },
            create: { orderId, activityId, pushToken, userId: order.userId },
        });
        this.logger.log(`Registered LiveActivity for order ${orderId}`);
        return ola;
    }
    async update(orderId, state) {
        const ola = await this.prisma.orderLiveActivity.findUnique({ where: { orderId } });
        if (!ola || ola.isEnded)
            return;
        await (0, live_apns_1.sendLiveActivityPush)(ola.pushToken, {
            aps: { event: 'update', 'content-state': state, timestamp: Math.floor(Date.now() / 1000) }
        });
    }
    async end(orderId, finalStatus) {
        const ola = await this.prisma.orderLiveActivity.findUnique({ where: { orderId } });
        if (!ola || ola.isEnded)
            return;
        await (0, live_apns_1.sendLiveActivityPush)(ola.pushToken, {
            aps: {
                event: 'end',
                'content-state': { orderId, status: finalStatus ?? 'ENTREGADO' },
                timestamp: Math.floor(Date.now() / 1000),
                'stale-date': Math.floor(Date.now() / 1000) + 1800
            }
        });
        await this.prisma.orderLiveActivity.update({ where: { orderId }, data: { isEnded: true } });
    }
};
exports.LiveActivitiesService = LiveActivitiesService;
exports.LiveActivitiesService = LiveActivitiesService = LiveActivitiesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LiveActivitiesService);
//# sourceMappingURL=live-activities.service.js.map