alter table tenants add column if not exists procurement_enabled boolean not null default false;

create table if not exists supplier_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  credentials jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists product_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  provider text not null,
  source_url text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists external_procurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  status text not null default 'pending' check (status in ('pending', 'ordered', 'failed', 'skipped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
