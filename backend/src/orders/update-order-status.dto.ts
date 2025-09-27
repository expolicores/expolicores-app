import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: 'EN_CAMINO',
    description:
      'Nuevo estado de la orden. Nota: si WHATSAPP_STATUS_NOTIFS=true, se enviará un WhatsApp al cliente para EN_CAMINO/ENTREGADO/CANCELADO.',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
