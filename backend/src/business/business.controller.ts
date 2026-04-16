import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BusinessService } from './business.service';
import { ApplyBusinessDto } from './dto/apply-business.dto';

@Controller('business')
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(private service: BusinessService) {}

  @Post('apply')
  async apply(@CurrentUser() user, @Body() _dto: ApplyBusinessDto) {
    return this.service.apply(user.id);
  }

  @Get('me')
  async me(@CurrentUser() user) {
    const [u] = await this.service.listApplications({});
    // Si quieres sólo el propio usuario:
    // return this.service.getById(user.id)
    return u && u.id === user.id ? u : { id: user.id };
  }
}
