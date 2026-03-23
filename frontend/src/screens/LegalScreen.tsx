// frontend/src/screens/LegalScreen.tsx
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, StatusBar } from 'react-native';

export default function LegalScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            marginBottom: 8,
            color: '#111827',
          }}
        >
          Términos y política de datos
        </Text>
        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
          Esta información aplica al uso de la aplicación móvil de Expolicores
          Villa de Leyva. Al usar la app aceptas estos términos y autorizas el
          tratamiento de tus datos personales según se describe a continuación.
        </Text>

        {/* 1. Política de privacidad */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            marginTop: 12,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1. Política de privacidad
        </Text>

        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.1. Datos que recopilamos
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Dependiendo de cómo uses la app podemos tratar, entre otros, los
          siguientes datos:
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>• Nombre y apellidos.</Text>
          <Text style={{ color: '#374151' }}>• Número de celular.</Text>
          <Text style={{ color: '#374151' }}>• Correo electrónico (si lo registras).</Text>
          <Text style={{ color: '#374151' }}>
            • Direcciones de entrega y datos de geolocalización asociados
            (latitud/longitud aproximada).
          </Text>
          <Text style={{ color: '#374151' }}>
            • Historial de pedidos, productos, montos y estados de entrega.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Tokens de notificaciones push del dispositivo.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Información técnica básica del dispositivo ({' '}
            sistema operativo, versión de app, identificadores internos de la
            app, etc.).
          </Text>
        </View>

        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.2. Finalidades del tratamiento
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Usamos tus datos personales, entre otras, para las siguientes
          finalidades:
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • Crear y administrar tu cuenta en Expolicores.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Validar tu identidad mediante códigos de verificación (OTP) enviados
            por SMS y, en el futuro, por otros canales autorizados.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Procesar tus pedidos, coordinar entregas y mostrar el historial de
            compras.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Calcular cobertura y costos de envío con base en tus direcciones y
            ubicación aproximada.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Enviarte notificaciones push sobre el estado de tus pedidos
            (pedido recibido, en camino, entregado, cancelado).
          </Text>
          <Text style={{ color: '#374151' }}>
            • Atender tus solicitudes de soporte y mejorar la experiencia de la
            app mediante analítica básica de uso.
          </Text>
        </View>

        {/* OTP / SMS / Twilio */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.3. OTP por SMS (Twilio)
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Para iniciar sesión usamos códigos de un solo uso (OTP) enviados a tu
          número de celular. Estos SMS se envían a través de un proveedor
          externo (Twilio) que actúa como encargado del tratamiento. El código
          se usa únicamente para validar que eres el titular del número y se
          elimina una vez es verificado o expira.
        </Text>

        {/* Geolocalización */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.4. Geolocalización y direcciones
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          La app usa direcciones y datos de geolocalización aproximada para:
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • Validar si tu dirección está dentro de la zona de cobertura.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Estimar distancias y calcular costos de envío.
          </Text>
        </View>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          No usamos tu ubicación para hacer tracking permanente ni para vender
          esta información a terceros. Tus direcciones se almacenan para
          facilitar futuros pedidos y pueden ser actualizadas o eliminadas desde
          la app.
        </Text>

        {/* Notificaciones push */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.5. Notificaciones push
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          La app puede enviarte notificaciones push a tu dispositivo. Por
          defecto se usan principalmente para:
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • Confirmar que recibimos tu pedido.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Informarte cuando el pedido está en camino o ha sido entregado.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Avisar si el pedido ha sido cancelado o requiere tu atención.
          </Text>
        </View>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          En algunos casos podremos enviarte novedades o promociones relevantes,
          siempre respetando tus preferencias de notificaciones del sistema
          operativo. Puedes desactivar las notificaciones desde los ajustes de
          tu dispositivo.
        </Text>

        {/* Cesión a terceros */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.6. Encargados y terceros
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Podemos compartir algunos datos con proveedores que nos ayudan a
          prestar el servicio, por ejemplo:
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • Proveedores de SMS y mensajería (como Twilio).
          </Text>
          <Text style={{ color: '#374151' }}>
            • Proveedores de mapas y geocodificación (como Google Maps/Places).
          </Text>
          <Text style={{ color: '#374151' }}>
            • Plataformas de analítica o monitoreo de errores.
          </Text>
        </View>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Estos terceros tratan los datos siguiendo nuestras instrucciones y
          únicamente para las finalidades autorizadas.
        </Text>

        {/* Derechos del titular */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          1.7. Derechos sobre tus datos
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Como titular de la información personal puedes ejercer los derechos de
          acceso, rectificación, actualización y supresión de tus datos, así
          como revocar la autorización otorgada para su tratamiento, de acuerdo
          con la normativa aplicable.
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Para ejercer estos derechos puedes contactarnos a través de nuestros
          canales de atención (por ejemplo, correo electrónico o WhatsApp de
          soporte indicados en la app).
        </Text>

        {/* 2. Términos y condiciones de uso */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            marginTop: 16,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          2. Términos y condiciones de uso
        </Text>

        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          2.1. Objeto de la app
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          La aplicación de Expolicores permite a usuarios mayores de edad
          consultar productos, realizar pedidos de licores y bebidas, y
          solicitar su entrega en las direcciones de cobertura disponibles.
        </Text>

        {/* Alcohol / mayoría de edad */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          2.2. Venta de alcohol y mayoría de edad
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • La app está dirigida exclusivamente a personas mayores de 18 años.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Al registrarte y usar la app declaras bajo tu responsabilidad que
            eres mayor de edad y que la información que entregas es veraz.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Expolicores podrá, en cualquier momento, solicitar verificaciones
            adicionales de identidad o edad, y rechazar o cancelar pedidos si
            detecta incumplimiento de esta condición.
          </Text>
          <Text style={{ color: '#374151' }}>
            • El consumo de alcohol debe hacerse de forma responsable y
            respetando la normativa vigente (por ejemplo, prohibición de
            consumir en espacios públicos donde no esté permitido).
          </Text>
        </View>

        {/* Pedidos y entregas */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          2.3. Pedidos, precios y cobertura
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • Los productos, precios, tarifas de envío y tiempos estimados de
            entrega pueden variar según la zona, promociones y disponibilidad.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Un pedido puede ser rechazado o cancelado, por ejemplo, por falta
            de stock, error en precios, problemas de validación o situaciones de
            riesgo para el repartidor.
          </Text>
          <Text style={{ color: '#374151' }}>
            • La cobertura depende de la distancia frente a la tienda y puede
            cambiar con el tiempo.
          </Text>
        </View>

        {/* Cuentas y seguridad */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          2.4. Cuenta de usuario y seguridad
        </Text>
        <View style={{ marginLeft: 12, marginBottom: 4 }}>
          <Text style={{ color: '#374151' }}>
            • Eres responsable de mantener la confidencialidad del código OTP
            que recibes y de no compartirlo con terceros.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Cualquier actividad realizada desde tu cuenta se presume realizada
            por ti.
          </Text>
          <Text style={{ color: '#374151' }}>
            • Podemos suspender o cerrar tu cuenta en caso de uso indebido de la
            app, fraude, intento de manipular precios/promociones o violación de
            estos términos.
          </Text>
        </View>

        {/* Eliminación de cuenta */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 8,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          2.5. Eliminación de cuenta
        </Text>
        <Text style={{ color: '#374151', marginBottom: 4 }}>
          Podrás solicitar la eliminación de tu cuenta y de tus datos personales
          de acuerdo con los mecanismos que se irán habilitando en la app y en
          nuestros canales de atención. En ciertos casos podremos conservar
          información mínima necesaria para cumplir obligaciones legales o
          contables.
        </Text>

        {/* Cierre */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            marginTop: 12,
            marginBottom: 4,
            color: '#111827',
          }}
        >
          3. Actualizaciones
        </Text>
        <Text style={{ color: '#374151', marginBottom: 16 }}>
          Podemos actualizar esta política y estos términos cuando sea necesario
          para reflejar cambios en la operación de la app o en la normativa
          aplicable. En caso de cambios relevantes te informaremos a través de
          la app u otros canales apropiados.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
