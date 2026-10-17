-- Inicial de un pedido por negociación, no solo por la regla general.
-- · Cada pedido guarda el % de inicial con el que se creó (orders.deposit_percent).
-- · De dónde sale, en orden:
--   1. El % que pone owner o admin al crear el pedido (create_order, p_deposit_percent).
--   2. Desde el umbral: la inicial habitual del cliente (customer_agreements.deposit_percent) o,
--      si no tiene, el % de la regla (order_settings). Debajo del umbral: pago completo.
-- · Después de creado, owner o admin la cambian con motivo (change_order_deposit); queda en
--   order_deposit_changes.

alter table public.customer_agreements
  add column deposit_percent numeric(5, 2) check (deposit_percent is null or (deposit_percent >= 0 and deposit_percent <= 100));

comment on column public.customer_agreements.deposit_percent is
  'Inicial habitual de sus pedidos desde el umbral (vacío = la de la regla).';

grant insert (deposit_percent), update (deposit_percent) on public.customer_agreements to authenticated;

alter table public.orders
  add column deposit_percent numeric(5, 2) check (deposit_percent is null or (deposit_percent >= 0 and deposit_percent <= 100));

comment on column public.orders.deposit_percent is
  'Inicial pactada (% del total) con la que se fijó deposit_required_usd. Nulo en pedidos anteriores.';

-- Historial de cambios de inicial (inmutable).
create table public.order_deposit_changes (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.orders (sale_id),
  previous_percent numeric(5, 2),
  new_percent numeric(5, 2) not null,
  previous_usd numeric(20, 2) not null,
  new_usd numeric(20, 2) not null,
  reason text not null check (length(trim(reason)) between 3 and 300),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index order_deposit_changes_sale_idx on public.order_deposit_changes (sale_id);

create trigger order_deposit_changes_immutable before update or delete on public.order_deposit_changes
  for each row execute function public.prevent_mutation();
create trigger order_deposit_changes_no_truncate before truncate on public.order_deposit_changes
  for each statement execute function public.prevent_mutation();

alter table public.order_deposit_changes enable row level security;
create policy "order_deposit_changes: todo el equipo los ve" on public.order_deposit_changes for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
revoke all on table public.order_deposit_changes from anon, authenticated;
grant select on table public.order_deposit_changes to authenticated;

-- ============================================================
-- La inicial se fija al crear el pedido
-- ============================================================

create or replace function public.orders_set_deposit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.order_settings;
  v_total numeric;
  v_customer uuid;
  v_explicit numeric := nullif(current_setting('app.order_deposit_percent', true), '')::numeric;
  v_habitual numeric;
  v_percent numeric;
begin
  select * into v_settings from public.order_settings;
  select total_usd, customer_id into v_total, v_customer from public.sales where id = new.sale_id;
  select deposit_percent into v_habitual from public.customer_agreements where customer_id = v_customer;

  v_percent := case
    when v_explicit is not null then v_explicit
    when v_total >= v_settings.deposit_threshold_usd then coalesce(v_habitual, v_settings.deposit_percent)
    else 100
  end;
  new.deposit_percent := v_percent;
  new.deposit_required_usd := round(v_total * v_percent / 100, 2);
  return new;
end;
$$;

create trigger orders_set_deposit before insert on public.orders
  for each row execute function public.orders_set_deposit();

-- La inicial cambia solo desde change_order_deposit.
create or replace function public.orders_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sale_id is distinct from old.sale_id
     or new.stock_mode is distinct from old.stock_mode
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Solo se cambian la fecha prometida, la inicial y la entrega del pedido.';
  end if;
  if (new.deposit_required_usd is distinct from old.deposit_required_usd
      or new.deposit_percent is distinct from old.deposit_percent)
     and coalesce(current_setting('app.changing_deposit', true), '') <> old.sale_id::text then
    raise exception 'La inicial se cambia con change_order_deposit.';
  end if;
  if new.delivered_at is distinct from old.delivered_at
     and coalesce(current_setting('app.delivering_order', true), '') <> old.sale_id::text then
    raise exception 'El pedido se entrega con deliver_order.';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Crear un pedido con otra inicial (owner y admin)
-- ============================================================

drop function public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                                  jsonb, numeric, public.discount_type, numeric, text, text, timestamptz, numeric);

create function public.create_order(
  p_customer_id uuid,
  p_price_method_id uuid,
  p_channel public.sale_channel,
  p_delivery_method public.delivery_method,
  p_items jsonb,
  p_stock_mode public.order_stock_mode,
  p_promised_date date default null,
  p_payments jsonb default '[]',
  p_delivery_fee_usd numeric default 0,
  p_discount_type public.discount_type default null,
  p_discount_value numeric default null,
  p_discount_reason text default null,
  p_notes text default null,
  p_occurred_at timestamptz default null,
  p_vat_percent numeric default 0,
  -- Nulo: la habitual del cliente o la de la regla.
  p_deposit_percent numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
begin
  if p_deposit_percent is not null then
    if not public.has_role(array['owner', 'admin']::public.app_role[]) then
      raise exception 'Solo owner o admin pueden poner otra inicial.' using errcode = '42501';
    end if;
    if p_deposit_percent < 0 or p_deposit_percent > 100 then
      raise exception 'La inicial va de 0 a 100%%.';
    end if;
    perform set_config('app.order_deposit_percent', p_deposit_percent::text, true);
  end if;
  v_sale_id := public.create_order_engine(
    p_customer_id, p_price_method_id, p_channel, p_delivery_method, p_items, p_stock_mode, p_promised_date,
    p_payments, p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, p_occurred_at,
    p_vat_percent, null
  );
  perform set_config('app.order_deposit_percent', '', true);
  return v_sale_id;
end;
$$;

-- ============================================================
-- Cambiar la inicial de un pedido abierto (owner y admin, con motivo)
-- ============================================================

create or replace function public.change_order_deposit(p_sale_id uuid, p_percent numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_total numeric;
  v_new numeric;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner o admin cambian la inicial.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where sale_id = p_sale_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_order.delivered_at is not null or exists (select 1 from public.order_cancellations where sale_id = p_sale_id) then
    raise exception 'El pedido ya está cerrado.';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'La inicial va de 0 a 100%%.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indica el motivo del cambio.';
  end if;

  select total_usd into v_total from public.sales where id = p_sale_id;
  v_new := round(v_total * p_percent / 100, 2);
  if p_percent = v_order.deposit_percent and v_new = v_order.deposit_required_usd then
    return;
  end if;

  insert into public.order_deposit_changes (sale_id, previous_percent, new_percent, previous_usd, new_usd, reason)
  values (p_sale_id, v_order.deposit_percent, p_percent, v_order.deposit_required_usd, v_new, trim(p_reason));

  perform set_config('app.changing_deposit', p_sale_id::text, true);
  update public.orders set deposit_percent = p_percent, deposit_required_usd = v_new where sale_id = p_sale_id;
  perform set_config('app.changing_deposit', '', true);
end;
$$;

revoke all on function public.orders_set_deposit() from public, anon, authenticated;

revoke all on function
  public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                      jsonb, numeric, public.discount_type, numeric, text, text, timestamptz, numeric, numeric),
  public.change_order_deposit(uuid, numeric, text)
from public, anon;
grant execute on function
  public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                      jsonb, numeric, public.discount_type, numeric, text, text, timestamptz, numeric, numeric),
  public.change_order_deposit(uuid, numeric, text)
to authenticated;
