import { Controller, Get } from '@nestjs/common';
import * as pkg from '../package.json';

@Controller('_meta')
export class AppVersionController {
  @Get('version')
  getVersion() {
    return {
      name: pkg.name,
      version: pkg.version,
      commit:
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.GIT_COMMIT ??
        null,
      builtAt: process.env.BUILD_TIME ?? null,
    };
  }
}
