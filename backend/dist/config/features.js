"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('features', () => ({
    b2b: process.env.FEATURE_B2B === 'true',
}));
//# sourceMappingURL=features.js.map