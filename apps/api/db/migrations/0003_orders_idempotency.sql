alter table orders add column if not exists payment_idempotency_key text;
create unique index if not exists orders_payment_idempotency_key_idx
  on orders(payment_idempotency_key)
  where payment_idempotency_key is not null;
