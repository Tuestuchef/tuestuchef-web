-- Ventas. Modelo en docs/modelo-de-datos.md (sección 4).
-- - Total y saldo de la venta en USD de referencia; nunca en Bs.
-- - Cada pago guarda su moneda, monto, tasas del momento, su equivalente en USD y su valor real (USDT).
--   El dinero vive en el libro (sale_payment); sale_payments dice a qué venta se aplica.
-- - Cada método de pago define la tasa que lo convierte: bcv_usd, bcv_eur o none.
-- - Líneas de inventario descuentan stock; las de por encargo no.
-- - Todo inmutable. Estados de línea en una tabla de eventos. Anular revierte stock y pagos.
-- - Se escribe solo por funciones (create_sale, add_sale_payment, void_sale, set_sale_item_status).

-- ============================================================
-- Tipos
-- ============================================================

create type public.payment_rate_kind as enum ('bcv_usd', 'bcv_eur', 'none');
create type public.sale_channel as enum ('in_person', 'whatsapp', 'instagram', 'online_store');
create type public.delivery_method as enum ('pickup', 'delivery');
create type public.sale_line_source as enum ('stock', 'made_to_order');
create type public.sale_item_status as enum ('to_produce', 'in_production', 'ready', 'delivered');
create type public.discount_type as enum ('amount', 'percent');

-- ============================================================
-- Métodos de pago: tasa que convierte el precio en USD
-- ============================================================

alter table public.payment_methods add column rate_kind public.payment_rate_kind not null default 'none';

update public.payment_methods pm
set rate_kind = 'bcv_usd'
from public.accounts a
where a.id = pm.account_id and a.currency = 'VES';

-- Cuentas en Bs se convierten con una tasa BCV; USD y USDT no llevan tasa.
create or replace function public.payment_methods_check_rate_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency public.currency;
begin
  select currency into v_currency from public.accounts where id = new.account_id;
  if v_currency = 'VES' and new.rate_kind = 'none' then
    raise exception 'Un método que cobra en Bs necesita una tasa BCV (dólar o euro).';
  end if;
  if v_currency <> 'VES' and new.rate_kind <> 'none' then
    raise exception 'Solo los métodos que cobran en Bs llevan tasa BCV.';
  end if;
  return new;
end;
$$;

create trigger payment_methods_check_rate_kind
before insert or update on public.payment_methods
for each row execute function public.payment_methods_check_rate_kind();

grant insert (rate_kind), update (rate_kind) on public.payment_methods to authenticated;

-- ============================================================
-- Configuración de ventas (una sola fila)
-- ============================================================

create table public.sales_settings (
  id boolean primary key default true check (id),
  -- Descuento máximo que staff puede aplicar sin owner o admin.
  staff_max_discount_percent numeric(5, 2) not null default 10
    check (staff_max_discount_percent between 0 and 100),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.sales_settings (id) values (true);

create or replace function public.sales_settings_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create trigger sales_settings_audit before update on public.sales_settings
  for each row execute function public.sales_settings_audit();

-- ============================================================
-- Tablas
-- ============================================================

create sequence public.sale_number_seq;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  -- Correlativo de la nota de entrega.
  number bigint not null unique default nextval('public.sale_number_seq'),
  customer_id uuid references public.customers (id),
  channel public.sale_channel not null,
  -- Lista de precios usada.
  price_method_id uuid not null references public.payment_methods (id),
  delivery_method public.delivery_method not null,
  subtotal_usd numeric(20, 2) not null check (subtotal_usd >= 0),
  discount_type public.discount_type,
  discount_value numeric(20, 4),
  discount_usd numeric(20, 2) not null default 0 check (discount_usd >= 0),
  discount_reason text,
  discount_by uuid references public.profiles (id),
  delivery_fee_usd numeric(20, 2) not null default 0 check (delivery_fee_usd >= 0),
  total_usd numeric(20, 2) not null check (total_usd >= 0),
  bcv_usd_rate numeric(20, 8) not null check (bcv_usd_rate > 0),
  bcv_eur_rate numeric(20, 8) not null check (bcv_eur_rate > 0),
  binance_rate numeric(20, 8) not null check (binance_rate > 0),
  usd_usdt_rate numeric(20, 8) not null check (usd_usdt_rate > 0),
  notes text check (notes is null or length(notes) <= 500),
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint sales_discount_consistent check (
    (discount_usd = 0 and discount_type is null and discount_value is null and discount_reason is null and discount_by is null)
    or (discount_usd > 0 and discount_type is not null and discount_value > 0
        and length(trim(coalesce(discount_reason, ''))) > 0 and discount_by is not null)
  ),
  constraint sales_total_consistent check (total_usd = subtotal_usd - discount_usd + delivery_fee_usd)
);

create index sales_occurred_idx on public.sales (occurred_at desc);
create index sales_customer_idx on public.sales (customer_id) where customer_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  variant_id uuid not null references public.product_variants (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price_usd numeric(20, 2) not null check (unit_price_usd > 0),
  line_total_usd numeric(20, 2) not null check (line_total_usd >= 0),
  -- Copia del costo de la variante al vender (para márgenes).
  unit_cost_usdt numeric(20, 6),
  source public.sale_line_source not null,
  created_at timestamptz not null default now()
);

create index sale_items_sale_idx on public.sale_items (sale_id);

alter table public.stock_movements
  add constraint stock_movements_sale_item_id_fkey foreign key (sale_item_id) references public.sale_items (id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  ledger_entry_id uuid not null unique references public.ledger_entries (id),
  payment_method_id uuid not null references public.payment_methods (id),
  -- Lo que entró, en la moneda de la cuenta del método.
  currency public.currency not null,
  amount numeric(20, 2) not null check (amount > 0),
  rate_kind public.payment_rate_kind not null,
  -- Bs por unidad usados para convertir (null si el método no lleva tasa).
  applied_rate numeric(20, 8),
  -- Lo que cubre del saldo, en USD de referencia.
  usd_amount numeric(20, 6) not null check (usd_amount > 0),
  usdt_value numeric(20, 6) not null,
  bcv_usd_rate numeric(20, 8) not null,
  bcv_eur_rate numeric(20, 8) not null,
  binance_rate numeric(20, 8) not null,
  usd_usdt_rate numeric(20, 8) not null,
  receipt_path text check (receipt_path is null or receipt_path !~* '^[a-z]+://'),
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index sale_payments_sale_idx on public.sale_payments (sale_id);

create table public.sale_item_status_events (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id),
  status public.sale_item_status not null,
  note text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default clock_timestamp()
);

create index sale_item_status_events_item_idx on public.sale_item_status_events (sale_item_id, created_at desc);

create table public.sale_voids (
  sale_id uuid primary key references public.sales (id),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Inmutables.
do $$
declare
  t text;
begin
  foreach t in array array['sales', 'sale_items', 'sale_payments', 'sale_item_status_events', 'sale_voids']
  loop
    execute format('create trigger %1$s_immutable before update or delete on public.%1$s for each row execute function public.prevent_mutation()', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;

-- Los pagos de venta solo se revierten al anular la venta.
create or replace function public.ledger_entries_guard_sale_payment_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reverses_entry_id is not null
     and exists (select 1 from public.ledger_entries where id = new.reverses_entry_id and entry_type = 'sale_payment')
     and coalesce(current_setting('app.voiding_sale', true), '') = '' then
    raise exception 'Los pagos de una venta se revierten anulando la venta.';
  end if;
  return new;
end;
$$;

create trigger ledger_entries_guard_sale_payment_reversal
before insert on public.ledger_entries
for each row execute function public.ledger_entries_guard_sale_payment_reversal();

-- ============================================================
-- Vistas
-- ============================================================

-- Estado de cada venta (calculado: la venta nunca se edita).
create view public.sales_summary
with (security_invoker = true)
as
select
  s.id as sale_id,
  s.number,
  s.occurred_at,
  s.customer_id,
  s.channel,
  s.total_usd,
  coalesce(p.paid_usd, 0)::numeric(20, 6) as paid_usd,
  greatest(s.total_usd - coalesce(p.paid_usd, 0), 0)::numeric(20, 6) as balance_usd,
  coalesce(p.usdt_value, 0)::numeric(20, 6) as collected_usdt,
  (v.sale_id is not null) as is_voided,
  case
    when v.sale_id is not null then 'voided'
    when s.total_usd - coalesce(p.paid_usd, 0) <= 0.01 then 'paid'
    when coalesce(p.paid_usd, 0) > 0 then 'partial'
    else 'pending'
  end as payment_status
from public.sales s
left join (
  select sale_id, sum(usd_amount) as paid_usd, sum(usdt_value) as usdt_value
  from public.sale_payments
  group by sale_id
) p on p.sale_id = s.id
left join public.sale_voids v on v.sale_id = s.id;

-- Estado actual de cada línea: el último evento.
create view public.sale_item_current_status
with (security_invoker = true)
as
select distinct on (e.sale_item_id)
  e.sale_item_id,
  e.status,
  e.created_at as status_at
from public.sale_item_status_events e
order by e.sale_item_id, e.created_at desc, e.id desc;

-- Totales por día (hora de Caracas): solo owner y admin.
create view public.sales_daily_totals
with (security_invoker = true)
as
select
  (s.occurred_at at time zone 'America/Caracas')::date as sale_date,
  count(*) as sales_count,
  sum(s.total_usd)::numeric(20, 2) as total_usd,
  sum(ss.paid_usd)::numeric(20, 6) as paid_usd,
  sum(ss.balance_usd)::numeric(20, 6) as balance_usd,
  sum(ss.collected_usdt)::numeric(20, 6) as collected_usdt
from public.sales s
join public.sales_summary ss on ss.sale_id = s.id
where not ss.is_voided
  and public.has_role(array['owner', 'admin']::public.app_role[])
group by 1;

-- ============================================================
-- Funciones
-- ============================================================

-- Tasa vigente para convertir a Bs: registrada hoy o con fecha de hoy.
create or replace function public.require_current_exchange_rate()
returns public.exchange_rates
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rate public.exchange_rates;
begin
  v_rate := public.require_latest_exchange_rate();
  if v_rate.rate_date < public.caracas_today()
     and (v_rate.created_at at time zone 'America/Caracas')::date < public.caracas_today() then
    raise exception 'Falta la tasa BCV de hoy. Regístrala antes de cobrar en Bs.';
  end if;
  return v_rate;
end;
$$;

-- Registra un pago: entrada en el libro + su aplicación a la venta.
-- Interna: la llaman create_sale y add_sale_payment (ya validaron permisos).
create or replace function public.apply_sale_payment(
  p_sale_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_method public.payment_methods;
  v_account public.accounts;
  v_rate public.exchange_rates;
  v_applied_rate numeric;
  v_usd numeric;
  v_paid numeric;
  v_category_id uuid;
  v_entry public.ledger_entries;
  v_payment_id uuid;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if exists (select 1 from public.sale_voids where sale_id = p_sale_id) then
    raise exception 'La venta NE-% está anulada.', lpad(v_sale.number::text, 6, '0');
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero.';
  end if;

  select * into v_method from public.payment_methods where id = p_payment_method_id;
  if not found or not v_method.is_active then
    raise exception 'El método de pago no existe o está inactivo.';
  end if;
  select * into v_account from public.accounts where id = v_method.account_id;

  -- Bs: tasa de hoy obligatoria. USD y USDT: la última tasa (solo para el valor real).
  if v_method.rate_kind = 'none' then
    v_rate := public.require_latest_exchange_rate();
  else
    v_rate := public.require_current_exchange_rate();
  end if;

  v_applied_rate := case v_method.rate_kind
    when 'bcv_usd' then v_rate.bcv_usd
    when 'bcv_eur' then v_rate.bcv_eur
  end;
  v_usd := round(
    case
      when v_method.rate_kind <> 'none' then p_amount / v_applied_rate
      when v_account.currency = 'USDT' then p_amount / v_rate.usd_usdt
      else p_amount
    end,
    6
  );

  select coalesce(sum(usd_amount), 0) into v_paid from public.sale_payments where sale_id = p_sale_id;
  if v_paid + v_usd > v_sale.total_usd + 0.01 then
    raise exception 'El pago supera el saldo pendiente (US$ %).', round(v_sale.total_usd - v_paid, 2);
  end if;

  select id into v_category_id from public.movement_categories where is_system and type = 'sales';

  perform set_config('app.creating_sale_payment', p_sale_id::text, true);
  insert into public.ledger_entries (
    account_id, entry_type, category_id, amount, description,
    bcv_usd_rate, binance_rate, usd_usdt_rate, receipt_path
  )
  values (
    v_method.account_id, 'sale_payment', v_category_id, p_amount,
    'Venta NE-' || lpad(v_sale.number::text, 6, '0'),
    v_rate.bcv_usd, v_rate.binance_usdt, v_rate.usd_usdt, p_receipt_path
  )
  returning * into v_entry;
  perform set_config('app.creating_sale_payment', '', true);

  insert into public.sale_payments (
    sale_id, ledger_entry_id, payment_method_id, currency, amount, rate_kind, applied_rate,
    usd_amount, usdt_value, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, receipt_path, occurred_at
  )
  values (
    p_sale_id, v_entry.id, p_payment_method_id, v_entry.currency, p_amount, v_method.rate_kind, v_applied_rate,
    v_usd, v_entry.usdt_value, v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt,
    p_receipt_path, v_entry.occurred_at
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- Crea la venta completa en una transacción: líneas, stock, descuento y pagos.
-- p_items:    [{ "variant_id": uuid, "quantity": number, "source": "stock" | "made_to_order" }]
-- p_payments: [{ "payment_method_id": uuid, "amount": number, "receipt_path": text? }]
create or replace function public.create_sale(
  p_channel public.sale_channel,
  p_price_method_id uuid,
  p_delivery_method public.delivery_method,
  p_items jsonb,
  p_payments jsonb default '[]',
  p_customer_id uuid default null,
  p_delivery_fee_usd numeric default 0,
  p_discount_type public.discount_type default null,
  p_discount_value numeric default null,
  p_discount_reason text default null,
  p_notes text default null,
  p_delivered boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_management boolean := public.has_role(array['owner', 'admin']::public.app_role[]);
  v_rate public.exchange_rates;
  v_method public.payment_methods;
  v_sale_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_source public.sale_line_source;
  v_quantity numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_max_percent numeric;
  v_item_id uuid;
  v_lines jsonb := '[]';
  v_line jsonb;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar ventas.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

  select * into v_method from public.payment_methods where id = p_price_method_id;
  if not found or not v_method.is_active then
    raise exception 'El método de pago no existe o está inactivo.';
  end if;

  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and is_active) then
    raise exception 'El cliente no existe o está inactivo.';
  end if;

  if coalesce(p_delivery_fee_usd, 0) < 0 then
    raise exception 'El delivery no puede ser negativo.';
  end if;

  v_rate := public.require_latest_exchange_rate();

  -- Líneas: precio del método elegido; sin precio no se vende.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida.';
    end if;
    v_source := coalesce(v_item ->> 'source', 'stock')::public.sale_line_source;

    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;
    select * into v_product from public.products where id = v_variant.product_id;
    if not v_product.is_active or not v_variant.is_active then
      raise exception '"%" (%) está inactivo.', v_product.name, v_variant.sku;
    end if;

    if v_product.fulfillment_type = 'stock' and v_source <> 'stock' then
      raise exception '"%" se vende solo de inventario.', v_product.name;
    end if;
    if v_product.fulfillment_type = 'made_to_order' and v_source <> 'made_to_order' then
      raise exception '"%" se vende solo por encargo.', v_product.name;
    end if;

    select amount_usd into v_price
    from public.product_prices
    where product_id = v_product.id and payment_method_id = p_price_method_id;
    if v_price is null then
      raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_method.name;
    end if;

    v_subtotal := v_subtotal + round(v_price * v_quantity, 2);
    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
      'source', v_source, 'cost', v_variant.unit_cost_usdt
    );
  end loop;

  -- Descuento sobre los productos (no sobre el delivery), con motivo y límite para staff.
  if p_discount_type is not null and coalesce(p_discount_value, 0) > 0 then
    if coalesce(trim(p_discount_reason), '') = '' then
      raise exception 'Indica el motivo del descuento.';
    end if;
    v_discount := case p_discount_type
      when 'percent' then round(v_subtotal * least(p_discount_value, 100) / 100, 2)
      else round(p_discount_value, 2)
    end;
    if v_discount > v_subtotal then
      raise exception 'El descuento no puede superar el subtotal.';
    end if;
    if not v_is_management and v_subtotal > 0 then
      select staff_max_discount_percent into v_max_percent from public.sales_settings;
      if v_discount / v_subtotal * 100 > v_max_percent + 0.0001 then
        raise exception '%', format('El descuento máximo sin owner o admin es %s%%.', trim_scale(v_max_percent));
      end if;
    end if;
  end if;

  insert into public.sales (
    customer_id, channel, price_method_id, delivery_method,
    subtotal_usd, discount_type, discount_value, discount_usd, discount_reason, discount_by,
    delivery_fee_usd, total_usd, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, notes
  )
  values (
    p_customer_id, p_channel, p_price_method_id, p_delivery_method,
    v_subtotal,
    case when v_discount > 0 then p_discount_type end,
    case when v_discount > 0 then p_discount_value end,
    v_discount,
    case when v_discount > 0 then trim(p_discount_reason) end,
    case when v_discount > 0 then auth.uid() end,
    round(coalesce(p_delivery_fee_usd, 0), 2),
    v_subtotal - v_discount + round(coalesce(p_delivery_fee_usd, 0), 2),
    v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt,
    nullif(trim(p_notes), '')
  )
  returning id into v_sale_id;

  perform set_config('app.creating_sale', v_sale_id::text, true);
  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.sale_items (sale_id, variant_id, quantity, unit_price_usd, line_total_usd, unit_cost_usdt, source)
    values (
      v_sale_id, (v_line ->> 'variant_id')::uuid, (v_line ->> 'quantity')::numeric, (v_line ->> 'price')::numeric,
      round((v_line ->> 'price')::numeric * (v_line ->> 'quantity')::numeric, 2),
      (v_line ->> 'cost')::numeric, (v_line ->> 'source')::public.sale_line_source
    )
    returning id into v_item_id;

    -- Inventario: sale del stock (el trigger bloquea si no alcanza). Por encargo: no toca stock.
    if v_line ->> 'source' = 'stock' then
      insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id)
      values ((v_line ->> 'variant_id')::uuid, 'sale', -(v_line ->> 'quantity')::numeric, (v_line ->> 'cost')::numeric, v_item_id);
    end if;

    insert into public.sale_item_status_events (sale_item_id, status)
    values (
      v_item_id,
      case
        when v_line ->> 'source' = 'made_to_order' then 'to_produce'
        when p_delivered then 'delivered'
        else 'ready'
      end::public.sale_item_status
    );
  end loop;
  perform set_config('app.creating_sale', '', true);

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    perform public.apply_sale_payment(
      v_sale_id,
      (v_payment ->> 'payment_method_id')::uuid,
      (v_payment ->> 'amount')::numeric,
      nullif(v_payment ->> 'receipt_path', '')
    );
  end loop;

  return v_sale_id;
end;
$$;

-- Abono o pago posterior: convierte con la tasa del día en que se paga.
create or replace function public.add_sale_payment(
  p_sale_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar pagos.' using errcode = '42501';
  end if;
  return public.apply_sale_payment(p_sale_id, p_payment_method_id, p_amount, p_receipt_path);
end;
$$;

-- Anular: owner y admin, con motivo. Revierte los pagos en el libro y devuelve el stock.
create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_payment record;
  v_item record;
  v_label text;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin pueden anular ventas.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la anulación.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  v_label := 'NE-' || lpad(v_sale.number::text, 6, '0');
  if exists (select 1 from public.sale_voids where sale_id = p_sale_id) then
    raise exception 'La venta % ya está anulada.', v_label;
  end if;

  insert into public.sale_voids (sale_id, reason) values (p_sale_id, trim(p_reason));

  perform set_config('app.voiding_sale', p_sale_id::text, true);
  for v_payment in select ledger_entry_id from public.sale_payments where sale_id = p_sale_id loop
    insert into public.ledger_entries (reverses_entry_id, description)
    values (v_payment.ledger_entry_id, 'Anulación de ' || v_label || ': ' || trim(p_reason));
  end loop;
  perform set_config('app.voiding_sale', '', true);

  perform set_config('app.creating_sale', p_sale_id::text, true);
  for v_item in
    select m.variant_id, m.quantity, m.unit_cost_usdt, m.sale_item_id
    from public.stock_movements m
    join public.sale_items i on i.id = m.sale_item_id
    where i.sale_id = p_sale_id and m.movement_type = 'sale'
  loop
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id, note)
    values (v_item.variant_id, 'sale_reversal', -v_item.quantity, v_item.unit_cost_usdt, v_item.sale_item_id,
            'Anulación de ' || v_label);
  end loop;
  perform set_config('app.creating_sale', '', true);
end;
$$;

-- Avanza el estado de una línea (solo hacia adelante). En Fase 1 se hace a mano.
create or replace function public.set_sale_item_status(
  p_sale_item_id uuid,
  p_status public.sale_item_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.sale_items;
  v_current public.sale_item_status;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_item from public.sale_items where id = p_sale_item_id;
  if not found then
    raise exception 'La línea no existe.';
  end if;
  if exists (select 1 from public.sale_voids where sale_id = v_item.sale_id) then
    raise exception 'La venta está anulada.';
  end if;

  select status into v_current from public.sale_item_current_status where sale_item_id = p_sale_item_id;
  if v_current is not null and p_status <= v_current then
    raise exception 'El estado solo avanza (actual: %).', v_current;
  end if;

  insert into public.sale_item_status_events (sale_item_id, status, note)
  values (p_sale_item_id, p_status, nullif(trim(p_note), ''));
end;
$$;

-- ============================================================
-- RLS y permisos: todos leen; nadie escribe directo (solo las funciones).
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['sales', 'sale_items', 'sale_payments', 'sale_item_status_events', 'sale_voids']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: todo el equipo los ve" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'', ''staff'']::public.app_role[]))', t);
  end loop;
end;
$$;

alter table public.sales_settings enable row level security;

create policy "sales_settings: todo el equipo la ve"
on public.sales_settings for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "sales_settings: owner y admin la editan"
on public.sales_settings for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table
  public.sales, public.sale_items, public.sale_payments, public.sale_item_status_events, public.sale_voids,
  public.sales_settings, public.sales_summary, public.sale_item_current_status, public.sales_daily_totals
from anon, authenticated;
revoke all on sequence public.sale_number_seq from anon, authenticated;

grant select on
  public.sales, public.sale_items, public.sale_payments, public.sale_item_status_events, public.sale_voids,
  public.sales_settings, public.sales_summary, public.sale_item_current_status, public.sales_daily_totals
to authenticated;
grant update (staff_max_discount_percent) on public.sales_settings to authenticated;

revoke execute on function
  public.payment_methods_check_rate_kind(),
  public.sales_settings_audit(),
  public.ledger_entries_guard_sale_payment_reversal(),
  public.apply_sale_payment(uuid, uuid, numeric, text)
from public, anon, authenticated;

revoke execute on function
  public.require_current_exchange_rate(),
  public.create_sale(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric, public.discount_type, numeric, text, text, boolean),
  public.add_sale_payment(uuid, uuid, numeric, text),
  public.void_sale(uuid, text),
  public.set_sale_item_status(uuid, public.sale_item_status, text)
from public, anon;

grant execute on function
  public.require_current_exchange_rate(),
  public.create_sale(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric, public.discount_type, numeric, text, text, boolean),
  public.add_sale_payment(uuid, uuid, numeric, text),
  public.void_sale(uuid, text),
  public.set_sale_item_status(uuid, public.sale_item_status, text)
to authenticated;
