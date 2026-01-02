# RingPlaza v1 scaffolding

## Stack
- Monorepo (npm workspaces) with `apps/api` (Fastify + Kysely + GraphQL) and `apps/web` (Next.js 14 SSR).
- Postgres + RLS per tenant, Redis placeholder, MinIO for object storage.
- Shared types via `packages/shared`.
- Docker Compose for db/redis/storage/api/web.

## Running locally
```
npm install
npm run migrate
npm run seed
npm run dev   # API on 4000, web on 3000
```
Environment defaults live in `apps/api/.env.example`. Web uses `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_TENANT_HOST` (defaults to http://localhost:4000 and demo.shops.ringplaza.com).

## Tenancy model
- `tenants` table with plan/billing mode/timezone/theme settings.
- RLS via `app.current_tenant` setting; `withTenantContext` wraps DB calls and sets `SET LOCAL app.current_tenant = ...`.
- Routing resolves tenant from `x-tenant` or Host header; preview domains follow `{slug}.shops.ringplaza.com`.
- Usage gating tracked in `tenant_usage` with grace window.

## API surface
- REST: `/api/tenants` (provision), `/api/tenant`, `/api/products`, `/api/checkout`, `/api/imports`.
- GraphQL at `/graphql` with `tenant`, `products`, `orders`, `createOrder`.
- Payments are stubbed via hosted checkout URL generator; Stripe/PayPal secrets are wired for real integration later.

## Storefront
- Next.js app dir, Option A palette, hero + PDP + cart/checkout + admin shell + onboarding notes.
- Uses `lib/api.ts` with `x-tenant` header to the API.

## Ops + migrations
- SQL migrations in `apps/api/db/migrations` with RLS and seed plans.
- `apps/api/scripts/migrate.ts` and `seed.ts` run via `npm run migrate` / `npm run seed`.
- Dockerfiles for api/web plus `docker-compose.yml` for local stack.
