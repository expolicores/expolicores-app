// backend/src/logs/logs.controller.ts
import { Body, Controller, Post } from '@nestjs/common';

@Controller('logs')
export class LogsController {
  @Post('client')
  client(@Body() body: any) {
    // imprime plano: Railway lo guarda y puedes filtrar por scope/step
    console.log('[CLIENT]', JSON.stringify(body));
    return { ok: true };
  }
}
