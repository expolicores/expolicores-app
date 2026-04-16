import { Module, forwardRef } from '@nestjs/common';
import { LiveActivitiesService } from './live-activities.service';
import { OrdersModule } from '../orders/orders.module'; // <-- sólo si LiveActivitiesService usa Orders*

@Module({
  // Si LiveActivitiesService NO depende de Orders*, quita la línea de imports
  imports: [
    // Elimina esta línea si NO hay dependencia de Orders desde LiveActivitiesService
    forwardRef(() => OrdersModule),
  ],
  providers: [LiveActivitiesService],
  exports: [LiveActivitiesService], // <-- clave: exportar el servicio
})
export class LiveActivitiesModule {}
