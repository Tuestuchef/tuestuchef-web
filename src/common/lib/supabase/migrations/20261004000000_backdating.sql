-- Registros con fecha pasada (ventas, pagos y movimientos del libro).
-- - Nunca fechas futuras. Staff retrocede hasta N días (configurable, 7 por defecto); más, solo owner y admin.
-- - Con fecha pasada se usan SIEMPRE las tasas de esa fecha; si no existen, se bloquea.
--   Tasas de una fecha D = una fila con rate_date = D, o la registrada ese día D (la foto diaria
--   del BCV, que no publica fines de semana ni feriados). Una corrección cargada después para D gana.
-- - Las tasas no se escriben a mano en la venta ni en el movimiento: se ignoran y se usan las de la fecha.
-- - Ventas y pagos con fecha distinta al día de registro quedan marcados como retroactivos.

alter table public.sales_settings
  add column staff_max_backdate_days integer not null default 7 check (staff_max_backdate_days between 0 and 365);

grant update (staff_max_backdate_days) on public.sales_settings to authenticated;

alter table public.sales add column is_backdated boolean not null default false;
alter table public.sale_payments add column is_backdated boolean not null default false;

-- ============================================================
-- Tasas de una fecha y límite de retroceso
-- ============================================================

create or replace function public.exchange_rate_for_date(p_date date)
returns public.exchange_rates
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.exchange_rates
  where rate_date <= p_date
    and (rate_date = p_date or (created_at at time zone 'America/Caracas')::date = p_date)
  order by rate_date desc, created_at desc
  limit 1;
$$;

create or replace function public.require_exchange_rate_for_date(p_date date)
returns public.exchange_rates
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rate public.exchange_rates;
begin
  v_rate := public.exchange_rate_for_date(p_date);
  if v_rate.id is null then
    raise exception 'No hay tasas registradas para el %. Owner o admin debe cargarlas en Tasas y cuentas.',
      to_char(p_date, 'DD/MM/YYYY');
  end if;
  return v_rate;
end;
$$;

-- Valida la fecha de un registro: nada futuro; staff solo hasta el límite configurado.
create or replace function public.check_occurred_at(p_occurred_at timestamptz)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date := (p_occurred_at at time zone 'America/Caracas')::date;
  v_max integer;
begin
  if p_occurred_at > now() + interval '5 minutes' or v_date > public.caracas_today() then
    raise exception 'La fecha no puede ser futura.';
  end if;
  if v_date < public.caracas_today() and not public.has_role(array['owner', 'admin']::public.app_role[]) then
    select staff_max_backdate_days into v_max from public.sales_settings;
    if public.caracas_today() - v_date > coalesce(v_max, 7) then
      raise exception 'Solo puedes registrar hasta % días atrás. Para fechas anteriores, pide a owner o admin.',
        coalesce(v_max, 7);
    end if;
  end if;
  return v_date;
end;
$$;

-- ============================================================
-- Libro: movimientos con fecha pasada usan las tasas de esa fecha.
-- Corre antes de ledger_entries_before_insert (orden alfabético de triggers).
-- Los reversos copian las tasas del original; los traspasos traen las suyas.
-- ============================================================

create or replace function public.ledger_entries_backdate_rates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_rate public.exchange_rates;
begin
  if new.reverses_entry_id is not null or new.transfer_id is not null then
    return new;
  end if;

  v_date := public.check_occurred_at(coalesce(new.occurred_at, now()));
  if v_date < public.caracas_today() then
    v_rate := public.require_exchange_rate_for_date(v_date);
    new.bcv_usd_rate := v_rate.bcv_usd;
    new.binance_rate := v_rate.binance_usdt;
    new.usd_usdt_rate := v_rate.usd_usdt;
  end if;
  return new;
end;
$$;

create trigger ledger_entries_backdate_rates
before insert on public.ledger_entries
for each row execute function public.ledger_entries_backdate_rates();

-- ============================================================
-- Pagos de venta con fecha
-- ============================================================

drop function public.add_sale_payment(uuid, uuid, numeric, text);
drop function public.apply_sale_payment(uuid, uuid, numeric, text);

create function public.apply_sale_payment(
  p_sale_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_receipt_path text default null,
  p_occurred_at timestamptz default null
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
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_date date;
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

  v_date := public.check_occurred_at(v_at);
  if v_date < (v_sale.occurred_at at time zone 'America/Caracas')::date then
    raise exception 'El pago no puede ser anterior a la venta.';
  end if;

  select * into v_method from public.payment_methods where id = p_payment_method_id;
  if not found or not v_method.is_active then
    raise exception 'El método de pago no existe o está inactivo.';
  end if;
  select * into v_account from public.accounts where id = v_method.account_id;

  -- Fecha pasada: tasas de esa fecha. Hoy: Bs exige la de hoy; USD/USDT la última.
  if v_date < public.caracas_today() then
    v_rate := public.require_exchange_rate_for_date(v_date);
  elsif v_method.rate_kind = 'none' then
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
    account_id, entry_type, category_id, amount, description, occurred_at,
    bcv_usd_rate, binance_rate, usd_usdt_rate, receipt_path
  )
  values (
    v_method.account_id, 'sale_payment', v_category_id, p_amount,
    'Venta NE-' || lpad(v_sale.number::text, 6, '0'), v_at,
    v_rate.bcv_usd, v_rate.binance_usdt, v_rate.usd_usdt, p_receipt_path
  )
  returning * into v_entry;
  perform set_config('app.creating_sale_payment', '', true);

  insert into public.sale_payments (
    sale_id, ledger_entry_id, payment_method_id, currency, amount, rate_kind, applied_rate,
    usd_amount, usdt_value, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, receipt_path,
    occurred_at, is_backdated
  )
  values (
    p_sale_id, v_entry.id, p_payment_method_id, v_entry.currency, p_amount, v_method.rate_kind, v_applied_rate,
    v_usd, v_entry.usdt_value, v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt,
    p_receipt_path, v_entry.occurred_at, v_date < public.caracas_today()
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create function public.add_sale_payment(
  p_sale_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_receipt_path text default null,
  p_occurred_at timestamptz default null
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
  return public.apply_sale_payment(p_sale_id, p_payment_method_id, p_amount, p_receipt_path, p_occurred_at);
end;
$$;

-- ============================================================
-- Ventas con fecha
-- ============================================================

drop function public.create_sale(
  public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
  public.discount_type, numeric, text, text, boolean
);

create function public.create_sale(
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
  p_delivered boolean default false,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_management boolean := public.has_role(array['owner', 'admin']::public.app_role[]);
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_date date;
  v_is_backdated boolean;
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

  -- Fecha: nada futuro, límite para staff y, si es pasada, las tasas de esa fecha.
  v_date := public.check_occurred_at(v_at);
  v_is_backdated := v_date < public.caracas_today();
  if v_is_backdated then
    v_rate := public.require_exchange_rate_for_date(v_date);
  else
    v_rate := public.require_latest_exchange_rate();
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
    delivery_fee_usd, total_usd, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, notes,
    occurred_at, is_backdated
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
    nullif(trim(p_notes), ''),
    v_at, v_is_backdated
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

    if v_line ->> 'source' = 'stock' then
      insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id, occurred_at)
      values ((v_line ->> 'variant_id')::uuid, 'sale', -(v_line ->> 'quantity')::numeric, (v_line ->> 'cost')::numeric,
              v_item_id, v_at);
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

  -- Pagos al registrar la venta: misma fecha que la venta.
  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    perform public.apply_sale_payment(
      v_sale_id,
      (v_payment ->> 'payment_method_id')::uuid,
      (v_payment ->> 'amount')::numeric,
      nullif(v_payment ->> 'receipt_path', ''),
      v_at
    );
  end loop;

  return v_sale_id;
end;
$$;

-- ============================================================
-- Permisos
-- ============================================================

revoke execute on function
  public.ledger_entries_backdate_rates(),
  public.apply_sale_payment(uuid, uuid, numeric, text, timestamptz)
from public, anon, authenticated;

revoke execute on function
  public.exchange_rate_for_date(date),
  public.require_exchange_rate_for_date(date),
  public.check_occurred_at(timestamptz),
  public.create_sale(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric, public.discount_type, numeric, text, text, boolean, timestamptz),
  public.add_sale_payment(uuid, uuid, numeric, text, timestamptz)
from public, anon;

grant execute on function
  public.exchange_rate_for_date(date),
  public.require_exchange_rate_for_date(date),
  public.check_occurred_at(timestamptz),
  public.create_sale(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric, public.discount_type, numeric, text, text, boolean, timestamptz),
  public.add_sale_payment(uuid, uuid, numeric, text, timestamptz)
to authenticated;
