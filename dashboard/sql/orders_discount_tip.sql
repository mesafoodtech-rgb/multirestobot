-- Descuento y propina opcionales en pedidos (mesa / mozo).
alter table public.orders
  add column if not exists discount_amount numeric(12, 2) check (discount_amount is null or discount_amount >= 0);

alter table public.orders
  add column if not exists tip_amount numeric(12, 2) check (tip_amount is null or tip_amount >= 0);

comment on column public.orders.discount_amount is 'Descuento en pesos aplicado al subtotal del pedido.';
comment on column public.orders.tip_amount is 'Propina en pesos sumada al total del pedido.';
