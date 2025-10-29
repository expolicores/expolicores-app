import {
  Controller,
  Get,
  Post,
  Headers,
  Query,
  HttpCode,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed') // ✅ ruta base: /feed
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getFeed(
    @CurrentUser() user: any,
    @Query('previewUrl') previewUrl?: string,
    @Headers('x-admin-token') adminToken?: string,
  ) {
    const canPreview =
      previewUrl && adminToken && adminToken === process.env.FEED_ADMIN_TOKEN
        ? previewUrl
        : undefined;

    return this.feedService.getFeedForUser(
      {
        role: user?.role ?? 'B2C',
        businessVerificationStatus: user?.businessVerificationStatus ?? 'NONE',
      },
      { previewUrl: canPreview },
    );
  }

  @Post('_purge') // ✅ /feed/_purge
  @HttpCode(204)
  purge(@Headers('x-admin-token') token?: string) {
    if (token !== process.env.FEED_ADMIN_TOKEN) {
      throw new ForbiddenException();
    }
    this.feedService.purge();
  }
}
