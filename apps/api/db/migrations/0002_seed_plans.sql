insert into plans (id, name, monthly_price_cents, order_limit)
values
  ('starter', 'Starter', 699, 100),
  ('unlimited', 'Unlimited', 1599, null)
on conflict (id) do update
  set name = excluded.name,
      monthly_price_cents = excluded.monthly_price_cents,
      order_limit = excluded.order_limit,
      updated_at = now();
