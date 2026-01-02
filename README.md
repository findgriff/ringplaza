# RingPlaza

Multi-tenant storefront SaaS scaffold (API-first backend + SSR storefront) with per-tenant RLS, theme settings, and default marketing/admin shells.

## Quickstart
1) Install deps: `npm install`
2) Start data services: `docker compose up db redis storage -d`
3) Run migrations + seed: `npm run migrate && npm run seed`
4) Dev servers: `npm run dev` (API on 4000, web on 3000)

Set API env in `apps/api/.env` (copy from `.env.example`). Web expects `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_TENANT_HOST` (defaults are fine for local preview domain `demo.shops.ringplaza.com`).

Stripe checkout (real): set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `apps/api/.env`, then run `stripe listen --forward-to localhost:4000/webhooks/stripe` while testing the cart “Pay with Stripe” flow.
PayPal sandbox: set `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` and use the cart “Pay with PayPal” flow.
Email: set `SMTP_URL` and `FROM_EMAIL` to send order confirmations on payment finalization.
Usage metering: `metering_events` + `usage_monthly` roll up on payment finalization and via `npm run metrics`; checkout guard enforces Starter (100 orders + 10 grace) vs Unlimited.
AliExpress/Shopify importers: stub endpoints for Shopify CSV/GraphQL and AliExpress URL, admin imports UI, procurement scaffolding (procurement_enabled flag, external_procurements/product_sources tables).
Installer & infra: `infra/scripts/install.sh` prompts for domain/email, writes `.env` / `apps/api/.env`, and brings up compose with Caddy/HTTPS. See `docs/QUICKSTART.md` for DNS/TLS and troubleshooting.

## Structure
- `apps/api`: Fastify REST + GraphQL, Kysely/Postgres, RLS, billing gating, import + checkout stubs.
- `apps/web`: Next.js 14 app dir storefront with marketing hero, PDP, cart/checkout, admin shell.
- `packages/shared`: Cross-app types + theme defaults.
- `docker-compose.yml`: Postgres/Redis/MinIO + app builds.
- `docs/ARCHITECTURE.md`: Architecture + tenancy notes.

## Notes
- Tenancy is enforced via Postgres RLS using `SET LOCAL app.current_tenant`; use `withTenantContext` helpers.
- Payment flows are stubbed to hosted URLs; swap in Stripe/PayPal SDKs using the provided gateway interface.
- Billing gating tracks order counts + grace; upgrade banners can be driven from the `/api/checkout` response.
