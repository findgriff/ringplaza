#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Please install Docker and rerun."
  exit 1
fi

RAM_MB=$(awk '/MemTotal/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null || echo "unknown")
echo "Detected RAM: ${RAM_MB}MB"

read -rp "Base domain (e.g. ringplaza.test or yourdomain.com): " BASE_DOMAIN
BASE_DOMAIN=${BASE_DOMAIN:-ringplaza.test}
read -rp "Caddy email for TLS (e.g. you@example.com): " CADDY_EMAIL
CADDY_EMAIL=${CADDY_EMAIL:-admin@example.com}

WEB_DOMAIN="app.${BASE_DOMAIN}"
API_DOMAIN="api.${BASE_DOMAIN}"
PREVIEW_DOMAIN="demo.shops.${BASE_DOMAIN}"

ENV_FILE="${ROOT_DIR}/.env"
cat >"$ENV_FILE" <<EOF
BASE_DOMAIN=${BASE_DOMAIN}
WEB_DOMAIN=${WEB_DOMAIN}
API_DOMAIN=${API_DOMAIN}
CADDY_EMAIL=${CADDY_EMAIL}
NODE_ENV=production
PORT=4000
APP_URL=https://${API_DOMAIN}
WEB_APP_URL=https://${WEB_DOMAIN}
DATABASE_URL=postgres://postgres:postgres@db:5432/ringplaza
REDIS_URL=redis://redis:6379
JWT_SECRET=$(openssl rand -hex 16)
STORAGE_BUCKET=ringplaza
STORAGE_ENDPOINT=http://storage:9000
STORAGE_ACCESS_KEY=minio
STORAGE_SECRET_KEY=minio123
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_starter
STRIPE_PRICE_UNLIMITED=price_unlimited
STRIPE_PRICE_PROCUREMENT=price_procurement
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
SMTP_URL=smtp://user:pass@smtp:1025
FROM_EMAIL=store@example.com
NEXT_PUBLIC_API_BASE_URL=https://${API_DOMAIN}
NEXT_PUBLIC_TENANT_HOST=${PREVIEW_DOMAIN}
EOF

cp "$ENV_FILE" "${ROOT_DIR}/apps/api/.env"

echo "Environment written to .env and apps/api/.env"
echo "Bringing up services..."
(cd "$ROOT_DIR" && docker compose up -d --build)

echo "If using a real domain, point DNS A records for ${WEB_DOMAIN} and ${API_DOMAIN} to this server IP, then rerun compose so Caddy can obtain TLS."
echo "Visit https://${WEB_DOMAIN} to continue setup."
