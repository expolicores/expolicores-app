"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveActivitiesModule = void 0;
const common_1 = require("@nestjs/common");
const live_activities_service_1 = require("./live-activities.service");
const orders_module_1 = require("../orders/orders.module"); // <-- sólo si LiveActivitiesService usa Orders*
let LiveActivitiesModule = class LiveActivitiesModule {
};
exports.LiveActivitiesModule = LiveActivitiesModule;
exports.LiveActivitiesModule = LiveActivitiesModule = __decorate([
    (0, common_1.Module)({
        // Si LiveActivitiesService NO depende de Orders*, quita la línea de imports
        imports: [
            // Elimina esta línea si NO hay dependencia de Orders desde LiveActivitiesService
            (0, common_1.forwardRef)(() => orders_module_1.OrdersModule),
        ],
        providers: [live_activities_service_1.LiveActivitiesService],
        exports: [live_activities_service_1.LiveActivitiesService], // <-- clave: exportar el servicio
    })
], LiveActivitiesModule);
//# sourceMappingURL=live-activities.module.js.map