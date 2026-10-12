-- Acuerdos con clientes fijos (p. ej. una escuela de cocina):
-- · Productos y combos exclusivos de un cliente (products.exclusive_customer_id): solo se le venden
--   o presupuestan a él.
-- · Precios del acuerdo (customer_agreements + customer_agreement_prices): por producto o combo, un
--   % de descuento o un precio fijo en USD; si no, el % general del acuerdo. El recargo por talla o
--   color se suma encima. Con acuerdo no se aplica el descuento al mayor por cantidad.
-- · Las ventas, pedidos y presupuestos guardan el precio aplicado: cambiar el acuerdo no cambia
--   lo ya registrado.
--
-- Cómo se aplica sin reescribir el cálculo de ventas y presupuestos: create_sale_engine y
-- quote_apply quedan envueltas por una función que anota el cliente de la operación
-- (app.pricing_customer); variant_price_usd y volume_discount_percent lo leen.

-- ============================================================
-- Tablas
-- ============================================================

alter table public.products add column exclusive_customer_id uuid references public.customers (id);
create index products_exclusive_customer_idx on public.products (exclusive_customer_id) where exclusive_customer_id is not null;

create table public.customer_agreements (
  customer_id uuid primary key references public.customers (id),
  -- % de descuento para todo lo que no tenga su propio precio en el acuerdo (vacío = ninguno).
  general_discount_percent numeric(5, 2) check (general_discount_percent is null or (general_discount_percent > 0 and general_discount_percent < 100)),
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.customer_agreement_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_agreements (customer_id) on delete cascade,
  product_id uuid not null references public.products (id),
  discount_percent numeric(5, 2) check (discount_percent is null or (discount_percent > 0 and discount_percent < 100)),
  fixed_price_usd numeric(20, 2) check (fixed_price_usd is null or fixed_price_usd > 0),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint customer_agreement_prices_one_rule check (num_nonnulls(discount_percent, fixed_price_usd) = 1),
  constraint customer_agreement_prices_unique unique (customer_id, product_id)
);

create trigger customer_agreements_created_audit before insert on public.customer_agreements
  for each row execute function public.set_created_audit();
create trigger customer_agreements_updated_audit before update on public.customer_agreements
  for each row execute function public.set_updated_audit();
create trigger customer_agreement_prices_created_audit before insert on public.customer_agreement_prices
  for each row execute function public.set_created_audit();
create trigger customer_agreement_prices_updated_audit before update on public.customer_agreement_prices
  for each row execute function public.set_updated_audit();

-- Todo el equipo los ve (para vender con ellos); solo owner y admin los cambian.
alter table public.customer_agreements enable row level security;
alter table public.customer_agreement_prices enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['customer_agreements', 'customer_agreement_prices']
  loop
    execute format(
      'create policy "%1$s: todo el equipo los ve" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'', ''staff'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin los crean" on public.%1$s for insert to authenticated with check (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin los editan" on public.%1$s for update to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[])) with check (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin los borran" on public.%1$s for delete to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
  end loop;
end;
$$;

revoke all on public.customer_agreements, public.customer_agreement_prices from anon, authenticated;
grant select, delete on public.customer_agreements, public.customer_agreement_prices to authenticated;
grant insert (customer_id, general_discount_percent, notes) on public.customer_agreements to authenticated;
-- (customer_id y product_id también: guardar con upsert los escribe en el UPDATE.)
grant update (customer_id, general_discount_percent, notes) on public.customer_agreements to authenticated;
grant insert (customer_id, product_id, discount_percent, fixed_price_usd) on public.customer_agreement_prices to authenticated;
grant update (customer_id, product_id, discount_percent, fixed_price_usd) on public.customer_agreement_prices to authenticated;

-- Quién marca un producto como exclusivo: lo mismo que quien edita productos.
grant update (exclusive_customer_id) on public.products to authenticated;

-- ============================================================
-- Precio con el acuerdo del cliente de la operación
-- ============================================================

-- Cliente de la venta, pedido o presupuesto que se está calculando (o nulo).
create or replace function public.pricing_customer()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.pricing_customer', true), '')::uuid;
$$;

create or replace function public.variant_price_usd(p_variant_id uuid, p_method_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select v.product_id,
           pp.amount_usd as base,
           case when p.kind = 'finished_good' then public.size_surcharge_usd(v.product_id, v.size_id, v.gender) else 0 end
             + coalesce(cs.amount_usd, 0) as surcharge
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_prices pp on pp.product_id = v.product_id and pp.payment_method_id = p_method_id
    left join public.color_surcharges cs on cs.product_id = v.product_id and cs.color_id = v.color_id and p.kind = 'finished_good'
    where v.id = p_variant_id
  ),
  rule as (
    select r.discount_percent, r.fixed_price_usd
    from public.customer_agreement_prices r, v
    where r.customer_id = public.pricing_customer() and r.product_id = v.product_id
  ),
  agreement as (
    select a.general_discount_percent from public.customer_agreements a where a.customer_id = public.pricing_customer()
  )
  select case
    when (select fixed_price_usd from rule) is not null then (select fixed_price_usd from rule) + v.surcharge
    when v.base is null then null
    when (select discount_percent from rule) is not null then round(v.base * (1 - (select discount_percent from rule) / 100), 2) + v.surcharge
    when (select general_discount_percent from agreement) is not null
      then round(v.base * (1 - (select general_discount_percent from agreement) / 100), 2) + v.surcharge
    else v.base + v.surcharge
  end
  from v;
$$;

-- Con acuerdo, el descuento al mayor de productos no se aplica (el acuerdo ya lo contempla).
create or replace function public.volume_discount_percent(p_scope public.volume_discount_scope, p_quantity numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_scope = 'products' and exists (select 1 from public.customer_agreements where customer_id = public.pricing_customer()) then 0
    else coalesce(
      (select percent from public.volume_discount_tiers
       where scope = p_scope and min_quantity <= p_quantity
       order by min_quantity desc limit 1),
      0
    )
  end;
$$;

-- Ventas y pedidos: el cálculo de siempre, con el cliente anotado mientras dura.
alter function public.create_sale_engine(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
  public.discount_type, numeric, text, text, boolean, timestamptz, numeric, boolean, numeric, jsonb)
  rename to create_sale_engine_base;

create function public.create_sale_engine(
  p_channel public.sale_channel,
  p_price_method_id uuid,
  p_delivery_method public.delivery_method,
  p_items jsonb,
  p_payments jsonb,
  p_customer_id uuid,
  p_delivery_fee_usd numeric,
  p_discount_type public.discount_type,
  p_discount_value numeric,
  p_discount_reason text,
  p_notes text,
  p_delivered boolean,
  p_occurred_at timestamptz,
  p_extra_subtotal_usd numeric,
  p_is_order boolean,
  p_vat_percent numeric,
  p_quote_pricing jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
begin
  perform set_config('app.pricing_customer', coalesce(p_customer_id::text, ''), true);
  v_sale_id := public.create_sale_engine_base(
    p_channel, p_price_method_id, p_delivery_method, p_items, p_payments, p_customer_id, p_delivery_fee_usd,
    p_discount_type, p_discount_value, p_discount_reason, p_notes, p_delivered, p_occurred_at,
    p_extra_subtotal_usd, p_is_order, p_vat_percent, p_quote_pricing
  );
  perform set_config('app.pricing_customer', '', true);
  return v_sale_id;
end;
$$;

-- Presupuestos: igual, con el cliente elegido en el presupuesto.
alter function public.quote_apply(uuid, jsonb) rename to quote_apply_base;

create function public.quote_apply(p_quote_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.pricing_customer', coalesce(nullif(p_payload ->> 'customer_id', ''), ''), true);
  perform public.quote_apply_base(p_quote_id, p_payload);
  perform set_config('app.pricing_customer', '', true);
end;
$$;

-- ============================================================
-- Exclusivos: solo para su cliente
-- ============================================================

create or replace function public.exclusive_product_check(p_variant_id uuid, p_customer_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product public.products;
begin
  select p.* into v_product from public.product_variants v join public.products p on p.id = v.product_id where v.id = p_variant_id;
  if v_product.exclusive_customer_id is not null and v_product.exclusive_customer_id is distinct from p_customer_id then
    raise exception '"%" es exclusivo de %: solo se le vende a ese cliente.',
      v_product.name, coalesce(public.customer_display_name(v_product.exclusive_customer_id), 'otro cliente');
  end if;
end;
$$;

create or replace function public.sale_items_check_exclusive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exclusive_product_check(new.variant_id, (select customer_id from public.sales where id = new.sale_id));
  return new;
end;
$$;

create trigger sale_items_check_exclusive before insert on public.sale_items
  for each row execute function public.sale_items_check_exclusive();

create or replace function public.quote_items_check_exclusive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exclusive_product_check(new.variant_id, (select customer_id from public.quotes where id = new.quote_id));
  return new;
end;
$$;

create trigger quote_items_check_exclusive before insert on public.quote_items
  for each row execute function public.quote_items_check_exclusive();

-- Cambiar el cliente de una venta con exclusivos de otro: no.
create or replace function public.sales_check_exclusive_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if new.customer_id is distinct from old.customer_id then
    for v_item in select variant_id from public.sale_items where sale_id = new.id loop
      perform public.exclusive_product_check(v_item.variant_id, new.customer_id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger sales_check_exclusive_customer before update of customer_id on public.sales
  for each row execute function public.sales_check_exclusive_customer();

revoke all on function
  public.create_sale_engine_base(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
    public.discount_type, numeric, text, text, boolean, timestamptz, numeric, boolean, numeric, jsonb),
  public.create_sale_engine(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
    public.discount_type, numeric, text, text, boolean, timestamptz, numeric, boolean, numeric, jsonb),
  public.quote_apply_base(uuid, jsonb),
  public.quote_apply(uuid, jsonb),
  public.exclusive_product_check(uuid, uuid),
  public.sale_items_check_exclusive(),
  public.quote_items_check_exclusive(),
  public.sales_check_exclusive_customer()
from public, anon, authenticated;
