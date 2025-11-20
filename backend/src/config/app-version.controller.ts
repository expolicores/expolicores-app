// backend/src/config/app-version.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('config/app')
export class AppConfigController {
  @Get('version')
  getVersionConfig() {
    return {
      minSupportedVersion: '1.0.0', // por debajo de esto, bloqueas
      latestVersion: '1.2.3',       // última en tiendas
      forceUpdate: false,           // si quieres obligar incluso si >= minSupported
      storeUrls: {
        android: 'https://play.google.com/store/apps/details?id=com.expolicores.app',
        ios: 'https://apps.apple.com/app/id1234567890',
      },
      // opcional: mensajes custom para front
      messages: {
        title: 'Nueva versión disponible',
        body: 'Actualiza para disfrutar de mejoras en estabilidad y nuevas funciones.',
        forceTitle: 'Actualización requerida',
        forceBody: 'Esta versión ya no es compatible. Por favor actualiza para continuar.',
      },
    };
  }
}
