"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BodegaModule = void 0;
const common_1 = require("@nestjs/common");
const bodega_controller_1 = require("./bodega.controller");
const bodega_service_1 = require("./bodega.service");
let BodegaModule = class BodegaModule {
};
exports.BodegaModule = BodegaModule;
exports.BodegaModule = BodegaModule = __decorate([
    (0, common_1.Module)({
        controllers: [bodega_controller_1.BodegaController],
        providers: [bodega_service_1.BodegaService],
    })
], BodegaModule);
//# sourceMappingURL=bodega.module.js.map