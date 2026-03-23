import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [HttpModule],      // ✅ requerido por FeedService
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
