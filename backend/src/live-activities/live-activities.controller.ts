import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LiveActivitiesService } from './live-activities.service';

@Controller('live-activities')
@UseGuards(JwtAuthGuard)
export class LiveActivitiesController {
  constructor(private svc: LiveActivitiesService) {}

  @Post('register')
  async register(@Body() body: { orderId: number; activityId: string; pushToken: string; }) {
    return this.svc.register(body);
  }

  @Post('end')
  async end(@Body() body: { orderId: number; finalStatus?: string }) {
    return this.svc.end(body.orderId, body.finalStatus);
  }
}