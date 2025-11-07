"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/main.ts
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const morgan_1 = __importDefault(require("morgan"));
const bodyParser = __importStar(require("body-parser"));
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
// Filtro global para mapear errores Prisma → HTTP
const prisma_exception_filter_1 = require("./common/filters/prisma-exception.filter");
async function bootstrap() {
    // Creamos la app (CORS lo configuramos explícitamente luego)
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: false });
    const config = app.get(config_1.ConfigService);
    // ======= Global Prefix (opcional por ENV) =======
    // Coloca GLOBAL_PREFIX=api en Railway si quieres que todo quede bajo /api/*
    const prefixEnv = (config.get('GLOBAL_PREFIX') || '').trim();
    const globalPrefix = prefixEnv ? prefixEnv.replace(/^\/+|\/+$/g, '') : '';
    if (globalPrefix) {
        app.setGlobalPrefix(globalPrefix);
    }
    // ======= Raw body (webhooks) =======
    // Guarda el cuerpo "tal cual" para validación de firma
    app.use(bodyParser.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf?.toString();
        },
    }));
    app.use(bodyParser.urlencoded({
        extended: true,
        verify: (req, _res, buf) => {
            req.rawBody = buf?.toString();
        },
    }));
    // ======= Validación global =======
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    // ======= Filtro global Prisma =======
    app.useGlobalFilters(new prisma_exception_filter_1.PrismaClientExceptionFilter());
    // ======= CORS =======
    // En dev: origin:true. En prod: define ORIGINS_CSV="https://app.expressapp.net,https://www.expressapp.net"
    const nodeEnv = (config.get('NODE_ENV') || 'development').toLowerCase();
    const originsCsv = (config.get('ORIGINS_CSV') || '').trim();
    const origins = nodeEnv === 'production' && originsCsv
        ? originsCsv.split(',').map((s) => s.trim()).filter(Boolean)
        : true; // dev: permitir cualquiera (útil para Expo Go)
    app.enableCors({
        origin: origins,
        credentials: false,
        exposedHeaders: ['X-Total-Count'],
    });
    // ======= Logs HTTP =======
    app.use((0, morgan_1.default)('dev'));
    // ======= Swagger =======
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Expolicores API')
        .setDescription('Documentación de la API de Expolicores')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    // Si hay globalPrefix, Swagger quedará accesible en /<prefix>/docs
    swagger_1.SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
    // ======= Puerto/host =======
    const port = Number(config.get('PORT')) || 3000;
    const host = (config.get('HOST') || '0.0.0.0');
    await app.listen(port, host);
    // ======= Logs de arranque =======
    const baseUrl = await app.getUrl(); // ej: http://127.0.0.1:8080 en Railway
    const prefixStr = globalPrefix ? `/${globalPrefix}` : '';
    const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'n/a';
    console.log(`🚀 Servidor corriendo en ${baseUrl}${prefixStr} (host=${host}, env=${nodeEnv}, commit=${commit})`);
    console.log(`📚 Swagger: ${baseUrl}${prefixStr}/docs`);
    console.log(`🌐 CORS origins: ${Array.isArray(origins) ? origins.join(', ') : 'ANY (dev)'}`);
    console.log(`💡 Endpoints base: ${baseUrl}${prefixStr}  (ej: ${baseUrl}${prefixStr}/auth/me, ${baseUrl}${prefixStr}/feed)`);
    if (host === '0.0.0.0') {
        console.log(`💡 Desde el iPhone usa: http://<IP_LAN_DE_TU_PC>:${port}${prefixStr}/docs`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map