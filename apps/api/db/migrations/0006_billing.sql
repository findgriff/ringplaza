create table if not exists tenant_subscriptions (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  price_id text,
  plan_id text references plans(id),
  status text,
  procurement_addon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_subscriptions_customer_idx on tenant_subscriptions(stripe_customer_id);
create index if not exists tenant_subscriptions_subscription_idx on tenant_subscriptions(stripe_subscription_id);
