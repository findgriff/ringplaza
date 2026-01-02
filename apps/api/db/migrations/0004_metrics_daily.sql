create table if not exists metrics_daily (
  tenant_id uuid not null references tenants(id) on delete cascade,
  day date not null,
  orders integer not null default 0,
  revenue_cents integer not null default 0,
  aov_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, day)
);
