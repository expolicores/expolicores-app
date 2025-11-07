"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaClientExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaClientExceptionFilter = class PrismaClientExceptionFilter {
    catch(exception, host) {
        // Mapea códigos -> HttpException
        let httpError;
        switch (exception.code) {
            case 'P2025': // Record not found
                httpError = new common_1.NotFoundException('NOT_FOUND');
                break;
            case 'P2002': // Unique constraint failed
                // Puedes incluir el campo único en el mensaje si quieres: exception.meta?.target
                httpError = new common_1.ConflictException('UNIQUE_CONSTRAINT_VIOLATION');
                break;
            case 'P2003': // Foreign key constraint failed
                httpError = new common_1.BadRequestException('FOREIGN_KEY_CONSTRAINT');
                break;
            case 'P2000': // Value too long for column
                httpError = new common_1.BadRequestException('VALUE_TOO_LONG');
                break;
            case 'P2016': // Query interpretation error
            case 'P2018': // Required connected records not found
            case 'P2014': // The change you are trying to make would violate...
                httpError = new common_1.BadRequestException('INVALID_REQUEST');
                break;
            default:
                // Si no mapeamos, deja que Nest maneje como 500
                httpError = new common_1.BadRequestException('PRISMA_ERROR');
                break;
        }
        // Responder
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const status = (httpError.getStatus && httpError.getStatus()) || 400;
        res.status(status).json({
            statusCode: status,
            code: httpError.response?.message || 'ERROR',
            // Info útil para debugging en dev (opcional, NO en prod)
            // prisma: { code: exception.code, meta: exception.meta },
        });
    }
};
exports.PrismaClientExceptionFilter = PrismaClientExceptionFilter;
exports.PrismaClientExceptionFilter = PrismaClientExceptionFilter = __decorate([
    (0, common_1.Catch)(client_1.Prisma.PrismaClientKnownRequestError)
], PrismaClientExceptionFilter);
//# sourceMappingURL=prisma-exception.filter.js.map