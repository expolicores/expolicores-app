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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
// backend/src/users/users.service.ts
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcryptjs"));
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
        /** Proyección segura: nunca devolvemos password ni campos sensibles */
        this.safeUserSelect = {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isEmailVerified: true,
            isPhoneVerified: true,
            createdAt: true,
            updatedAt: true,
        };
    }
    // ===== Helpers =====
    normalizeEmail(email) {
        const s = String(email ?? '').trim().toLowerCase();
        return s.length ? s : null;
    }
    /** Normaliza a E.164 CO (+57...). Acepta “+57…”, “57…”, “03…”, “3…”. */
    normalizePhone(raw) {
        const v = String(raw ?? '').trim();
        if (!v)
            return null;
        if (v.startsWith('+'))
            return v;
        const digits = v.replace(/\D/g, '').replace(/^0+/, '');
        const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
        return `+${withCountry}`;
    }
    // ===== Lectura =====
    async findAll() {
        return this.prisma.user.findMany({ select: this.safeUserSelect });
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: this.safeUserSelect,
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    /** Versión pública/segura por id (para /users/me) */
    async findPublicById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: this.safeUserSelect,
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    // ===== Escritura (perfil propio) =====
    /**
     * Actualiza el propio perfil del usuario autenticado.
     * - `name`: texto (min 2).
     * - `email` o `emailEnroll`: normaliza y garantiza unicidad; marca isEmailVerified=false.
     * - `phone`: **opcional**; si cambia, normaliza a E.164 y marca isPhoneVerified=false.
     * - `password`: compat (hash).
     *
     * Nota: la verificación OTP de teléfono NO se hace aquí.
     */
    async updateMe(userId, data) {
        const patch = {};
        // name
        if (typeof data.name === 'string') {
            const name = data.name.trim();
            if (name.length < 2)
                throw new common_1.BadRequestException('Nombre demasiado corto.');
            patch.name = name;
        }
        // Resolver fuente de email: `email` tiene prioridad; si no, `emailEnroll`
        const incomingEmailRaw = data.email !== undefined ? data.email : data.emailEnroll;
        if (incomingEmailRaw !== undefined) {
            const email = this.normalizeEmail(incomingEmailRaw);
            const current = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            });
            // Si realmente cambia el email…
            if ((current?.email ?? null) !== (email ?? null)) {
                if (email) {
                    const exists = await this.prisma.user.findUnique({ where: { email } });
                    if (exists && exists.id !== userId) {
                        throw new common_1.BadRequestException('Ese correo ya está en uso.');
                    }
                }
                patch.email = email; // puede ser null para limpiar
                patch.isEmailVerified = false;
                // TODO: opcional — generar token y enviar verificación por correo
            }
        }
        // phone — si decides permitirlo desde perfil (sin OTP). Se marca como no verificado.
        if (data.phone !== undefined) {
            const newPhone = this.normalizePhone(data.phone);
            const current = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { phone: true },
            });
            if ((current?.phone ?? null) !== (newPhone ?? null)) {
                if (newPhone) {
                    // Chequear unicidad si hay índice único condicional en phone
                    const clash = await this.prisma.user.findUnique({
                        where: { phone: newPhone },
                    });
                    if (clash && clash.id !== userId) {
                        throw new common_1.BadRequestException('Ese teléfono ya está asociado a otra cuenta.');
                    }
                }
                patch.phone = newPhone; // puede ser null para limpiar
                patch.isPhoneVerified = false;
            }
        }
        // password (compat)
        if (data.password) {
            if (String(data.password).length < 8) {
                throw new common_1.BadRequestException('La contraseña debe tener al menos 8 caracteres.');
            }
            patch.password = await bcrypt.hash(String(data.password), 10);
        }
        if (Object.keys(patch).length === 0) {
            return this.findPublicById(userId);
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: patch,
        });
        return this.findPublicById(userId);
    }
    /**
     * Compat: algunos controladores antiguos llamaban updateSelf.
     * Redirige a updateMe.
     */
    async updateSelf(id, dto) {
        return this.updateMe(id, dto);
    }
    // ===== Admin =====
    async updateRole(id, role) {
        const user = await this.prisma.user.update({
            where: { id },
            data: { role },
            select: this.safeUserSelect,
        });
        return user;
    }
    async remove(id) {
        await this.prisma.user.delete({ where: { id } });
        return { id };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map