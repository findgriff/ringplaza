# Quickstart

## One-liner install (fresh VPS)
```
curl -fsSL https://example.com/ringplaza/install.sh | bash
```
(In this repo, run `infra/scripts/install.sh` to generate `.env`, copy to `apps/api/.env`, and `docker compose up -d --build`.)

You’ll be prompted for a base domain and email (for Caddy/ACME). Point `app.<domain>` and `api.<domain>` DNS A records to your server IP, rerun compose, and Caddy will obtain TLS. For local testing, use hosts entries like `127.0.0.1 app.ringplaza.test api.ringplaza.test demo.shops.ringplaza.test`.

## Services
- Caddy (TLS + routing), API (Fastify), Web (Next.js), Worker placeholder, Postgres, Redis, MinIO.
- Healthchecks on db/redis/storage/api/web; Caddy fronts 80/443.

## Dev vs Prod
- Prod: set `NODE_ENV=production` in `.env`, point real DNS to the box, and use real Stripe/PayPal/SMTP secrets.
- Dev: you can run `docker compose up` with the default `.env.example` values; TLS will not be issued without public DNS.

## Commands
- Migrate: `npm run migrate --workspace @ringplaza/api`
- Seed: `npm run seed --workspace @ringplaza/api`
- Metrics rollup: `npm run metrics --workspace @ringplaza/api`
- Backup: `scripts/backup.sh` (writes `backups/ringplaza-<date>.sql`)

## Setup flow
1) Run install script and bring up compose.
2) Run migrations + seed (inside the api container or locally).
3) Visit `https://app.<domain>` to see storefront/admin; `https://api.<domain>/health` should return ok.
4) Configure Stripe/PayPal/SMTP envs and webhook listeners for payments.

## Troubleshooting
- Ports in use: stop other services on 80/443/3000/4000 or change the compose ports.
- TLS fails: verify DNS A records and that ports 80/443 are open; check `docker compose logs caddy`.
- API/Web unhealthy: `docker compose ps` then inspect logs (`docker compose logs api web`).
- Stripe webhook: ensure `STRIPE_WEBHOOK_SECRET` matches `stripe listen`, and port 4000 is reachable if using tunnel.
- Storage: if MinIO healthcheck fails, ensure `/data` volume is writable; reset with `docker volume rm ringplaza_storage-data` (will delete stored objects).
