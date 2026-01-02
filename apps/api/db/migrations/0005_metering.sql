create table if not exists metering_events (
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, order_id)
);

create table if not exists usage_monthly (
  tenant_id uuid not null references tenants(id) on delete cascade,
  year integer not null,
  month integer not null,
  orders_paid integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, year, month)
);
