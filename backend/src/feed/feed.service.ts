import { Injectable, ForbiddenException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

type Role = 'B2C' | 'B2B';
type BusinessStatus = 'NONE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

interface CurrentUserLite {
  role: Role;
  businessVerificationStatus?: BusinessStatus;
}

@Injectable()
export class FeedService {
  private etag?: string;
  private cached?: any;
  private lastFetch = 0;

  private readonly defaultTtl =
    Number(process.env.FEED_LATEST_TTL_SECONDS ?? 60) * 1000;
  private readonly maxItemsPerSlot =
    Number(process.env.FEED_MAX_ITEMS_PER_SLOT ?? 8);

  constructor(private readonly http: HttpService) {}

  private async download(url: string) {
    const headers: Record<string, string> = {};
    if (this.etag) headers['If-None-Match'] = this.etag;

    // Tipar explícitamente la respuesta para evitar "unknown"
    const res: AxiosResponse<any> = await firstValueFrom(
      this.http.get<any>(url, {
        headers,
        responseType: 'json',
        // Aceptamos 304 y cualquier 2xx
        validateStatus: () => true,
      }),
    );

    if (res.status === 304 && this.cached) {
      this.lastFetch = Date.now();
      return this.cached;
    }

    if (res.status >= 200 && res.status < 300) {
      // Algunos proxies pueden variar el casing de ETag
      const h = (res.headers || {}) as Record<string, string>;
      const etagHeader = h['etag'] ?? (h as any)['ETag'] ?? (h as any)['Etag'];
      if (etagHeader) this.etag = etagHeader;
      this.lastFetch = Date.now();
      this.cached = res.data;
      return this.cached;
    }

    throw new Error(`Feed fetch failed with status ${res.status}`);
  }

  private withinSchedule(slot: any, now: Date) {
    const start = slot?.schedule?.startAt ? new Date(slot.schedule.startAt) : null;
    const end = slot?.schedule?.endAt ? new Date(slot.schedule.endAt) : null;
    return (!start || now >= start) && (!end || now <= end);
  }

  private filterForUser(feed: any, user: CurrentUserLite) {
    const now = new Date();
    const slots = Array.isArray(feed?.slots) ? feed.slots : [];

    const filtered = slots.filter((s: any) => {
      const vis = s.visibility ?? {};
      const roles: Role[] = vis.roles ?? ['B2C', 'B2B'];
      const statuses: BusinessStatus[] = vis.businessStatus ?? [];

      const roleOk = roles.includes(user.role);
      const statusOk =
        statuses.length === 0 ||
        statuses.includes((user.businessVerificationStatus as BusinessStatus) ?? 'NONE');
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

  private assertPreviewUrlAllowed(url: string) {
    const allowedHost = process.env.FEED_PREVIEW_ALLOWED_HOST;
    const u = new URL(url);
    if (!allowedHost || u.hostname !== allowedHost) {
      throw new ForbiddenException('Preview host not allowed');
    }
    if (!u.pathname.startsWith('/feed/feed.') || !u.pathname.endsWith('.json')) {
      throw new ForbiddenException('Preview path not allowed');
    }
  }

  async getFeedForUser(
    user: CurrentUserLite,
    opts?: { previewUrl?: string; force?: boolean },
  ) {
    const url = opts?.previewUrl ?? process.env.FEED_JSON_URL!;
    if (!url) throw new Error('FEED_JSON_URL is not configured');

    if (opts?.previewUrl) this.assertPreviewUrlAllowed(opts.previewUrl);

    // Cache en memoria con TTL simple (solo aplica para la URL "latest", no para preview)
    const expired = Date.now() - this.lastFetch > this.defaultTtl;
    if (!opts?.force && this.cached && !expired && !opts?.previewUrl) {
      return this.filterForUser(this.cached, user);
    }

    try {
      const raw = await this.download(url);
      return this.filterForUser(raw, user);
    } catch (e) {
      // Tolerante a fallos: si tengo algo en cache, lo sirvo
      if (this.cached) return this.filterForUser(this.cached, user);
      throw e;
    }
  }

  purge() {
    this.etag = undefined;
    this.cached = undefined;
    this.lastFetch = 0;
  }
}
