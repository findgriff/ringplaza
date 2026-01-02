create extension if not exists "pgcrypto";

create table if not exists schema_migrations (
  id serial primary key,
  name text not null unique,
  executed_at timestamptz not null default now()
);

create table plans (
  id text primary key,
  name text not null,
  monthly_price_cents integer not null,
  order_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  domain text unique,
  preview_domain text not null unique,
  plan_id text not null references plans(id),
  billing_mode text not null default 'saas' check (billing_mode in ('saas', 'selfhost', 'appsumo')),
  timezone text not null default 'UTC',
  theme_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_usage (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  billing_month date not null,
  order_count integer not null default 0,
  last_reset timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  password_hash text,
  role text not null check (role in ('owner', 'admin', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key_hash text not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  handle text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, handle)
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null,
  price_cents integer not null,
  compare_at_price_cents integer,
  option_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  status text not null check (status in ('pending', 'paid', 'fulfilled', 'refunded', 'canceled')),
  procurement_status text default 'none' check (procurement_status in ('none', 'pending', 'ordered', 'failed')),
  total_cents integer not null,
  currency char(3) not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  url text not null,
  event text not null,
  secret text not null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor text not null,
  action text not null,
  entity text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source text not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- row level security
alter table tenants enable row level security;
alter table tenant_usage enable row level security;
alter table users enable row level security;
alter table api_keys enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table webhook_subscriptions enable row level security;
alter table audit_logs enable row level security;
alter table imports enable row level security;

create policy tenant_isolation_tenants on tenants
  using (id = current_setting('app.current_tenant', true)::uuid)
  with check (id = current_setting('app.current_tenant', true)::uuid);
create policy tenant_lookup on tenants for select
  using (
    current_setting('app.tenant_lookup', true) = '1'
    or id = current_setting('app.current_tenant', true)::uuid
  );

do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'tenant_usage',
    'users',
    'api_keys',
    'products',
    'product_variants',
    'orders',
    'webhook_subscriptions',
    'audit_logs',
    'imports'
  ])
  loop
    execute format('create policy tenant_isolation_%I on %I using (tenant_id = current_setting(''app.current_tenant'', true)::uuid) with check (tenant_id = current_setting(''app.current_tenant'', true)::uuid)', tbl, tbl);
  end loop;
end$$;
