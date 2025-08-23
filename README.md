"# App Expolicores" 

ExpolicoresApp — README técnico (MVP Backend + Plan)

Rama de referencia: dev del espejo público expolicores/expolicores-app-public.

1) Contexto & decisiones de negocio

Producto
E-commerce + delivery local de licores, abarrotes y aseo para Villa de Leyva y alrededores (“Rappi local”).

Alcance MVP

Catálogo, detalle y búsqueda de productos.

Carrito (lado cliente).

Pedido con pago contraentrega (datáfono).

Seguimiento básico del estado del pedido.

Políticas / Modelo de negocio

Sin comisiones a comercios (en fase multivendor se monetiza por visibilidad/banner).

Tarifa de envío fija o dinámica.

White-label para hoteles (checkout a la habitación).

2) Arquitectura

Stack

NestJS + TypeScript, arquitectura modular.

Prisma ORM + PostgreSQL (Railway).

Auth: JWT (Passport), Guards (JwtAuthGuard, RolesGuard, SelfOrAdminGuard).

Validación: class-validator / class-transformer.

Docs: Swagger (pendiente de pulir).

Capas (diagrama textual)

[Controllers HTTP]
  ├─ /auth (register/login/me)
  ├─ /users (me, list, update, role)
  ├─ /products (GET públicos; CRUD ADMIN)
  └─ /orders (crear, mis órdenes, listar, cambiar estado)
        │
[Services: lógica de dominio]
        │   └─ cálculo de total, RBAC, validaciones
        ▼
[Prisma Client: acceso a datos]
        ▼
[PostgreSQL (Railway)]

3) Estructura del repositorio (backend)
backend/
└─ src/
   ├─ app.module.ts
   ├─ prisma/
   │  └─ prisma.service.ts
   ├─ auth/
   │  ├─ auth.controller.ts
   │  ├─ auth.module.ts
   │  ├─ auth.service.ts
   │  ├─ jwt.strategy.ts
   │  ├─ decorators/
   │  │  ├─ current-user.decorator.ts
   │  │  └─ roles.decorator.ts
   │  ├─ guards/
   │  │  ├─ jwt-auth.guard.ts
   │  │  ├─ roles.guard.ts
   │  │  └─ self-or-admin.guard.ts
   │  └─ dto/
   │     ├─ login.dto.ts
   │     └─ register.dto.ts
   ├─ users/
   │  ├─ users.controller.ts
   │  ├─ users.module.ts
   │  ├─ users.service.ts
   │  ├─ update-user.dto.ts
   │  └─ update-user-role.dto.ts
   ├─ products/
   │  ├─ products.controller.ts
   │  ├─ products.module.ts
   │  ├─ products.service.ts
   │  ├─ create-product.dto.ts
   │  └─ update-product.dto.ts
   └─ orders/
      ├─ orders.controller.ts
      ├─ orders.module.ts
      ├─ orders.service.ts
      ├─ create-order.dto.ts
      ├─ update-order.dto.ts
      └─ update-order-status.dto.ts

4) Modelo de datos (Prisma)
enum Role { ADMIN CLIENTE }
enum OrderStatus { RECIBIDO EN_CAMINO ENTREGADO CANCELADO }

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  name      String
  phone     String   @default("0000000000")
  role      Role     @default(CLIENTE)
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Int
  stock       Int
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orderItems  OrderItem[]
}

model Order {
  id        Int          @id @default(autoincrement())
  userId    Int
  total     Float
  status    OrderStatus  @default(RECIBIDO)
  createdAt DateTime     @default(now())
  user      User         @relation(fields: [userId], references: [id])
  items     OrderItem[]
}

model OrderItem {
  id        Int      @id @default(autoincrement())
  orderId   Int
  productId Int
  quantity  Int
  order     Order   @relation(fields: [orderId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}


Direcciones (Address): aún no está en schema.prisma. Ver “Siguientes pasos”.

5) Endpoints por módulo

Auth: header Authorization: Bearer <token> cuando aplique.

Auth
Método	Ruta	Auth	Body (ej.)	Respuesta
POST	/auth/register	—	{ "name","email","password","phone" }	201 { userId, name, email, token }
POST	/auth/login	—	{ "email","password" }	200 { userId, name, email, token }
GET	/auth/me	JWT	—	200 { id, email, role, ... }
Users
Método	Ruta	Auth/Rol	Descripción
GET	/users	ADMIN	Lista de usuarios (sin password).
GET	/users/me	JWT	Perfil del usuario autenticado.
PATCH	/users/me	JWT	Actualiza { name?, phone?, password? }.
GET	/users/:id	JWT (Dueño o ADMIN)	Ver usuario por id.
PATCH	/users/:id	JWT (Dueño o ADMIN)	Actualiza datos.
PATCH	/users/:id/role	ADMIN	Cambia rol { role }.
DELETE	/users/:id	ADMIN	Eliminar usuario.
Products
Método	Ruta	Auth/Rol	Descripción
GET	/products	Público	Lista productos.
GET	/products/:id	Público	Detalle.
POST	/products	ADMIN	Crea producto.
PATCH	/products/:id	ADMIN	Actualiza.
DELETE	/products/:id	ADMIN	Elimina.
Orders
Método	Ruta	Auth/Rol	Descripción
POST	/orders	JWT	Crea orden (calcula total en server, status=RECIBIDO).
GET	/orders/my	JWT	Órdenes del usuario.
GET	/orders	ADMIN	Todas las órdenes.
GET	/orders/:id	JWT (Dueño o ADMIN)	Ver una orden.
PATCH	/orders/:id	ADMIN	Actualiza/reemplaza items (recalcula total).
PATCH	/orders/:id/status	ADMIN	Cambia estado (RECIBIDO/EN_CAMINO/ENTREGADO/CANCELADO).
DELETE	/orders/:id	ADMIN	Elimina orden (borra items primero).
Addresses (pendiente)

Propuesta: GET /addresses (JWT — propias) y POST /addresses (JWT — crear).

Relación: User 1─* Address.

6) Autenticación, autorización y seguridad

JWT: emitido en register/login; validado por JwtStrategy + JwtAuthGuard.

RBAC: @Roles(Role.ADMIN) + RolesGuard; para recursos del usuario, SelfOrAdminGuard (dueño o admin).

Buenas prácticas: password hasheado con bcrypt; select seguro (nunca devolver password).

Notas: por ahora, expiración de JWT desactivada (se puede activar expiresIn).

7) Variables de entorno

Crea backend/.env (no commitear):

PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=super-secret
GOOGLE_MAPS_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+57...
LOCAL_LAT=5.6369
LOCAL_LNG=-73.5280

8) Setup, migraciones y ejecución
# instalar deps
cd backend
npm install

# prisma (si cambiaste schema)
npx prisma migrate dev
npx prisma generate

# correr en dev
npm run start:dev


Railway

Conecta repo → setea variables → deploy.

Revisa logs de build y runtime.

9) Estado actual (comprobado)

Listo:

Auth JWT (/auth/register, /auth/login, /auth/me).

RBAC (ADMIN/CLIENTE) con guards y decoradores.

Products: GET públicos; CRUD solo ADMIN.

Orders: crear (cliente), mis órdenes, todas (ADMIN), cambio de status.

Pendiente / por priorizar:

Direcciones (modelo/CRUD mínimo).

Validaciones de stock/cobertura/deliveryFee/ETA.

WhatsApp (Twilio) al confirmar y al cambiar estado.

Swagger completo y ejemplos.

10) Historias de Usuario (mapa)
HU	Descripción	Estado
US01	Registro	✅ (Back listo)
US02	Login	✅ (Back listo)
US03	Listar direcciones	⬜ Pendiente (Back)
US04	Crear dirección	⬜ Pendiente (Back)
US05	Ver catálogo	✅
US06	Buscar productos	🟡 (agregar ?search= si no está)
US07	Detalle de producto	✅
US08	Carrito (cliente)	⬜ (FE)
US09	Confirmar pedido	🟡 (crear orden ok; falta address/fee/ETA)
US10	Confirmación por WhatsApp	⬜ (Back)
US11	Ver estado del pedido	✅
US12	Actualizaciones por WhatsApp	⬜ (Back)

Frontend (UI) en paralelo

Siguiente chat: arrancar FE de Auth (US01/US02).

Luego: catálogo/detalle (US05/US07), carrito (US08), direcciones (US03/US04), checkout (US09), tracking (US11).

11) Siguientes pasos priorizados

Backend

Direcciones: Address model + GET/POST /addresses.

Orders: validar stock + recalcular total + mapear P2025→404 donde falte.

Tarifa/ETA: stub inicial (radio + tarifa fija), luego Maps.

Twilio: WhatsappService + reintentos (US10/US12).

Frontend (otro chat)

Auth (US01/US02).

Home catálogo (US05), detalle (US07), carrito (US08).

Direcciones (US03/US04) + checkout (US09).

Estado de pedido (US11).

12) Anexo — Tabla de rutas & cURL
Tabla rápida
Método	Ruta	Auth	Rol	Propósito
POST	/auth/register	—	—	Registro
POST	/auth/login	—	—	Login
GET	/auth/me	JWT	—	Perfil del token
GET	/users	JWT	ADMIN	Listar usuarios
GET	/users/me	JWT	—	Mi perfil
PATCH	/users/me	JWT	—	Actualizar mi perfil
GET	/users/:id	JWT	Dueño/ADMIN	Ver usuario
PATCH	/users/:id	JWT	Dueño/ADMIN	Actualizar
PATCH	/users/:id/role	JWT	ADMIN	Cambiar rol
DELETE	/users/:id	JWT	ADMIN	Eliminar
GET	/products	—	—	Listar productos
GET	/products/:id	—	—	Detalle
POST	/products	JWT	ADMIN	Crear producto
PATCH	/products/:id	JWT	ADMIN	Actualizar
DELETE	/products/:id	JWT	ADMIN	Eliminar
POST	/orders	JWT	—	Crear orden
GET	/orders/my	JWT	—	Mis órdenes
GET	/orders	JWT	ADMIN	Todas las órdenes
GET	/orders/:id	JWT	Dueño/ADMIN	Ver orden
PATCH	/orders/:id	JWT	ADMIN	Actualizar orden
PATCH	/orders/:id/status	JWT	ADMIN	Cambiar estado
DELETE	/orders/:id	JWT	ADMIN	Eliminar orden
cURL — ejemplos

Registro

curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan","email":"juan@demo.com","password":"12345678","phone":"+573001112233"}'


Login (guardar token en variable de shell)

TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@demo.com","password":"12345678"}' | jq -r .token)
echo $TOKEN


/auth/me

curl http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"


Crear producto (ADMIN)

curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ron 8 años 750ml","price":85000,"stock":12,"description":"Añejo"}'


Crear orden (cliente)

curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":2,"quantity":1},{"productId":3,"quantity":2}]}'


Cambiar estado de la orden (ADMIN)

curl -X PATCH http://localhost:3000/orders/4/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"EN_CAMINO"}'


Reemplaza 4 por un orderId válido. En caso de id inexistente, Prisma arroja P2025 — recomendado mapearlo a 404.