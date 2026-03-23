// backend/src/config/app-config.module.ts
import { Module } from '@nestjs/common';
import { AppConfigController } from './app-version.controller';

@Module({
  controllers: [AppConfigController],
})
export class AppConfigModule {}
