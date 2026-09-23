# Wallet Loyalty Card

SaaS multiempresa para campañas de visitas y recompensas. Esta rama contiene el primer flujo funcional: alta de negocio, campaña, tarjeta anónima y registro de visitas. La publicación de pases en Apple, Google y Samsung Wallet, el registro con teléfono verificado y Stripe son entregas siguientes; el lanzamiento comercial requiere las tres wallets.

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

El token de tarjeta es un secreto de acceso: debe compartirse solo con su titular. El número de ticket, importe mínimo, intervalo entre visitas y objetivo se validan en una transacción con bloqueo de fila. Los endpoints de negocio comprueban rol y tenant en el servidor.

Consulte [docs/roadmap.md](docs/roadmap.md) para el alcance pendiente y las dependencias de wallets.
