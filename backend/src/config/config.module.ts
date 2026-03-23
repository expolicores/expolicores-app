// backend/src/config/config.module.ts
import { Module } from '@nestjs/common';
import { AppConfigController } from './app-version.controller';

@Module({
  controllers: [AppConfigController],
})
export class ConfigModule {}
