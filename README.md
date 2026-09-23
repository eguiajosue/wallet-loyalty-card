# Wallet Loyalty Card

SaaS multiempresa para campañas de visitas y recompensas. Incluye alta de negocio, campaña, tarjeta anónima, visitas, canje de premio fijo y solicitudes de cancelación con historial. La publicación de pases en Apple, Google y Samsung Wallet, el registro con teléfono verificado y Stripe son entregas siguientes; el lanzamiento comercial requiere las tres wallets.

## Requisitos

- Node.js 22 o superior
- Docker Compose para PostgreSQL 16

## Desarrollo local

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d db
npm install
npm run db:migrate
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Salud de API: http://localhost:4000/health

La migración es SQL versionado. `DATABASE_URL` se lee de `apps/api/.env` al ejecutar `db:migrate`. Para un despliegue, use un gestor de secretos para credenciales y configure `WEB_ORIGIN` y `PUBLIC_WEB_URL` con los dominios reales.

## Flujo inicial

1. `POST /auth/register` crea negocio, propietario y sucursal principal.
2. `POST /tenants/:tenantId/campaigns` crea una campaña con token de sesión.
3. `POST /campaigns/:campaignId/enrollments` emite una tarjeta anónima y devuelve su URL privada.
4. `GET /cards/:token` permite ver el progreso desde esa URL.
5. `POST /tenants/:tenantId/enrollments/:token/visits` registra una visita autorizada con `Idempotency-Key`, sucursal, folio e importe en centavos.
6. `GET /tenants/:tenantId/enrollments/:token` consulta visitas, solicitudes, canje e historial (autenticado).
7. `POST /tenants/:tenantId/enrollments/:token/redemptions` canjea la recompensa con `{ "branchId": "…" }` e `Idempotency-Key`. El canje cierra esa participación.

Desde el panel, la sección **Tarjetas y recompensas** permite consultar el enlace de la tarjeta y confirmar la entrega. El QR de esta versión se lee con un lector externo o se pega como enlace; el escáner por cámara está pendiente.

## Cancelaciones y auditoría

- `POST /tenants/:tenantId/enrollments/:token/visits/:visitId/cancellation` crea la solicitud con `{ "reason": "…" }`.
- `POST /tenants/:tenantId/enrollments/:token/cancellations/:requestId/decision` recibe `{ "decision": "approved|rejected", "reason": "…" }`.
- Empleado, gerente y propietario pueden solicitar una cancelación y canjear. Solo gerente y propietario pueden decidir una solicitud. La administración de esos miembros por interfaz es un siguiente incremento.
- Hay una solicitud por visita. Un rechazo es definitivo para esa solicitud. Un gerente o propietario puede decidir una solicitud propia; no se exige un segundo aprobador.
- Una aprobación retira un sello y puede volver a bloquear el premio. La visita y su ticket permanecen registrados; el ticket no se puede reutilizar.
- Una solicitud pendiente bloquea el canje. Una tarjeta canjeada no admite visitas nuevas ni cancelaciones.
- Se exige campaña activa y vigente para canjear. Una cancelación puede resolverse después de la caducidad para corregir el historial.
- Canjes, visitas y decisiones usan el mismo bloqueo por tarjeta. Cada operación y su evento de auditoría se confirman en la misma transacción.
- Los triggers rechazan UPDATE, DELETE y TRUNCATE de visitas, canjes y auditoría. No sustituyen los permisos y respaldos del servidor: un administrador de PostgreSQL puede modificar los triggers.

## Verificación

```bash
npm test
npm run build
# Solo sobre una base de datos desechable, ya migrada:
cd apps/api
node --env-file=.env --test dist/*integration.test.js
```

GitHub Actions crea PostgreSQL 16, aplica las migraciones dos veces para verificar su repetibilidad y ejecuta los escenarios de integración. Las pruebas dejan datos en la base desechable.

El token de tarjeta es un secreto de acceso: debe compartirse solo con su titular. El número de ticket, importe mínimo, intervalo entre visitas y objetivo se validan en una transacción con bloqueo de fila. Los endpoints de negocio comprueban rol y tenant en el servidor.

Consulte [docs/roadmap.md](docs/roadmap.md) para el alcance pendiente y las dependencias de wallets.
