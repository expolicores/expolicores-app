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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let FeedService = class FeedService {
    constructor(http) {
        this.http = http;
        this.lastFetch = 0;
        this.defaultTtl = Number(process.env.FEED_LATEST_TTL_SECONDS ?? 60) * 1000;
        this.maxItemsPerSlot = Number(process.env.FEED_MAX_ITEMS_PER_SLOT ?? 8);
    }
    async download(url) {
        const headers = {};
        if (this.etag)
            headers['If-None-Match'] = this.etag;
        // Tipar explícitamente la respuesta para evitar "unknown"
        const res = await (0, rxjs_1.firstValueFrom)(this.http.get(url, {
            headers,
            responseType: 'json',
            // Aceptamos 304 y cualquier 2xx
            validateStatus: () => true,
        }));
        if (res.status === 304 && this.cached) {
            this.lastFetch = Date.now();
            return this.cached;
        }
        if (res.status >= 200 && res.status < 300) {
            // Algunos proxies pueden variar el casing de ETag
            const h = (res.headers || {});
            const etagHeader = h['etag'] ?? h['ETag'] ?? h['Etag'];
            if (etagHeader)
                this.etag = etagHeader;
            this.lastFetch = Date.now();
            this.cached = res.data;
            return this.cached;
        }
        throw new Error(`Feed fetch failed with status ${res.status}`);
    }
    withinSchedule(slot, now) {
        const start = slot?.schedule?.startAt ? new Date(slot.schedule.startAt) : null;
        const end = slot?.schedule?.endAt ? new Date(slot.schedule.endAt) : null;
        return (!start || now >= start) && (!end || now <= end);
    }
    filterForUser(feed, user) {
        const now = new Date();
        const slots = Array.isArray(feed?.slots) ? feed.slots : [];
        const filtered = slots.filter((s) => {
            const vis = s.visibility ?? {};
            const roles = vis.roles ?? ['B2C', 'B2B'];
            const statuses = vis.businessStatus ?? [];
            const roleOk = roles.includes(user.role);
            const statusOk = statuses.length === 0 ||
                statuses.includes(user.businessVerificationStatus ?? 'NONE');
            const timeOk = this.withinSchedule(s, now);
            return roleOk && statusOk && timeOk;
        });
        // Limitar items por slot (defensa de rendimiento)
        for (const s of filtered) {
            if (Array.isArray(s.items) && s.items.length > this.maxItemsPerSlot) {
                s.items = s.items.slice(0, this.maxItemsPerSlot);
            }
        }
        return {
            version: feed?.version ?? '1',
            updatedAt: feed?.updatedAt,
            timezone: feed?.timezone ?? 'America/Bogota',
            slots: filtered,
        };
    }
    assertPreviewUrlAllowed(url) {
        const allowedHost = process.env.FEED_PREVIEW_ALLOWED_HOST;
        const u = new URL(url);
        if (!allowedHost || u.hostname !== allowedHost) {
            throw new common_1.ForbiddenException('Preview host not allowed');
        }
        if (!u.pathname.startsWith('/feed/feed.') || !u.pathname.endsWith('.json')) {
            throw new common_1.ForbiddenException('Preview path not allowed');
        }
    }
    async getFeedForUser(user, opts) {
        const url = opts?.previewUrl ?? process.env.FEED_JSON_URL;
        if (!url)
            throw new Error('FEED_JSON_URL is not configured');
        if (opts?.previewUrl)
            this.assertPreviewUrlAllowed(opts.previewUrl);
        // Cache en memoria con TTL simple (solo aplica para la URL "latest", no para preview)
        const expired = Date.now() - this.lastFetch > this.defaultTtl;
        if (!opts?.force && this.cached && !expired && !opts?.previewUrl) {
            return this.filterForUser(this.cached, user);
        }
        try {
            const raw = await this.download(url);
            return this.filterForUser(raw, user);
        }
        catch (e) {
            // Tolerante a fallos: si tengo algo en cache, lo sirvo
            if (this.cached)
                return this.filterForUser(this.cached, user);
            throw e;
        }
    }
    purge() {
        this.etag = undefined;
        this.cached = undefined;
        this.lastFetch = 0;
    }
};
exports.FeedService = FeedService;
exports.FeedService = FeedService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], FeedService);
//# sourceMappingURL=feed.service.js.map