-- Fase 2 · Dashboard (owner y admin): flujo de caja por cuenta, margen por producto vendido,
-- efecto de la tasa y asignaciones de la utilidad (reserva y reinversión).
-- Modelo en docs/modelo-de-datos.md (sección 9).
-- - La utilidad real sale del libro (analytics_ledger_summary). Reserva y reinversión son
--   asignaciones de la utilidad: se comparan con lo que dice la política, nunca se restan antes.
-- - Todas las funciones devuelven 0 filas a staff.

-- ============================================================
-- Política de utilidad (una fila)
-- ============================================================

create table public.profit_policy (
  id boolean primary key default true check (id),
  -- Cuenta de reserva real, en USDT.
  reserve_account_id uuid references public.accounts (id),
  reserve_percent numeric(5, 2) not null default 0 check (reserve_percent between 0 and 100),
  reinvestment_percent numeric(5, 2) not null default 0 check (reinvestment_percent between 0 and 100),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint profit_policy_total check (reserve_percent + reinvestment_percent <= 100)
);

insert into public.profit_policy (id) values (true);

create or replace function public.profit_policy_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency public.currency;
begin
  if new.reserve_account_id is not null then
    select currency into v_currency from public.accounts where id = new.reserve_account_id;
    if v_currency is distinct from 'USDT' then
      raise exception 'La cuenta de reserva debe ser en USDT.';
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create trigger profit_policy_validate before update on public.profit_policy
  for each row execute function public.profit_policy_validate();

alter table public.profit_policy enable row level security;

create policy "profit_policy: owner y admin la ven"
on public.profit_policy for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "profit_policy: owner y admin la editan"
on public.profit_policy for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- ============================================================
-- Flujo de caja por cuenta
-- ============================================================

-- Saldo al inicio, entradas, salidas y saldo al final del período, en la moneda de la
-- cuenta y en USDT (valor real al momento de cada movimiento). Incluye traspasos.
create or replace function public.cash_flow_by_account(p_from date, p_to date)
returns table (
  account_id uuid,
  name text,
  currency public.currency,
  is_active boolean,
  opening numeric,
  inflows numeric,
  outflows numeric,
  closing numeric,
  inflows_usdt numeric,
  outflows_usdt numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (p_from::timestamp at time zone 'America/Caracas') as start_at,
           ((p_to + 1)::timestamp at time zone 'America/Caracas') as end_at
  )
  select
    a.id,
    a.name,
    a.currency,
    a.is_active,
    coalesce(sum(l.amount) filter (where l.occurred_at < b.start_at), 0),
    coalesce(sum(l.amount) filter (where l.occurred_at >= b.start_at and l.occurred_at < b.end_at and l.amount > 0), 0),
    coalesce(-sum(l.amount) filter (where l.occurred_at >= b.start_at and l.occurred_at < b.end_at and l.amount < 0), 0),
    coalesce(sum(l.amount) filter (where l.occurred_at < b.end_at), 0),
    coalesce(sum(l.usdt_value) filter (where l.occurred_at >= b.start_at and l.occurred_at < b.end_at and l.amount > 0), 0),
    coalesce(-sum(l.usdt_value) filter (where l.occurred_at >= b.start_at and l.occurred_at < b.end_at and l.amount < 0), 0)
  from public.accounts a
  cross join bounds b
  left join public.ledger_entries l on l.account_id = a.id
  where public.has_role(array['owner', 'admin']::public.app_role[])
  group by a.id, a.name, a.currency, a.is_active
  order by a.is_active desc, a.name;
$$;

-- ============================================================
-- Margen por producto (ventas del período, sin anuladas)
-- ============================================================

-- Ingreso real de cada línea: su parte del total con descuento, convertida a USDT con las
-- tasas de la venta según el método de la lista de precios (Bs: × BCV ÷ Binance).
-- Costo: el copiado al vender (o el de su producción, si es por encargo) + mano de obra.
create or replace function public.product_sales_margin(p_from date, p_to date)
returns table (
  product_id uuid,
  product_name text,
  units numeric,
  revenue_usd numeric,
  revenue_usdt numeric,
  material_cost_usdt numeric,
  labor_cost_usdt numeric,
  margin_usdt numeric,
  lines_without_cost integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select
      p.id as product_id,
      p.name as product_name,
      i.quantity,
      -- Parte de la línea en el total de productos, después del descuento (sin delivery).
      i.line_total_usd * case when s.subtotal_usd > 0 then (s.subtotal_usd - s.discount_usd) / s.subtotal_usd else 0 end as net_usd,
      case pm.rate_kind
        when 'bcv_usd' then s.bcv_usd_rate / s.binance_rate
        when 'bcv_eur' then s.bcv_eur_rate / s.binance_rate
        else s.usd_usdt_rate
      end as real_factor,
      coalesce(i.unit_cost_usdt, r.unit_cost_usdt) as unit_cost,
      p.labor_cost_usdt
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    join public.payment_methods pm on pm.id = s.price_method_id
    join public.product_variants v on v.id = i.variant_id
    join public.products p on p.id = v.product_id
    left join public.production_runs r on r.sale_item_id = i.id
    where s.occurred_at >= (p_from::timestamp at time zone 'America/Caracas')
      and s.occurred_at < ((p_to + 1)::timestamp at time zone 'America/Caracas')
      and not exists (select 1 from public.sale_voids sv where sv.sale_id = s.id)
      and public.has_role(array['owner', 'admin']::public.app_role[])
  )
  select
    product_id,
    product_name,
    sum(quantity),
    round(sum(net_usd), 2),
    round(sum(net_usd * real_factor), 6),
    round(sum(quantity * coalesce(unit_cost, 0)), 6),
    round(sum(quantity * labor_cost_usdt), 6),
    round(sum(net_usd * real_factor) - sum(quantity * coalesce(unit_cost, 0)) - sum(quantity * labor_cost_usdt), 6),
    count(*) filter (where unit_cost is null)::integer
  from lines
  group by product_id, product_name
  order by 8 desc;
$$;

-- ============================================================
-- Efecto de la tasa
-- ============================================================

-- Ventas: lo cobrado en Bs se cobra a tasa BCV; su valor real (Binance) suele ser menor.
--   nominal = USD cubiertos × usd_usdt; real = usdt_value; diferencia = real − nominal (negativa = pérdida).
-- Compras: pagar en Bs a tasa BCV cuesta menos en valor real que la deuda en USD (ganancia).
--   nominal = USD cubiertos × usd_usdt; real = usdt_value pagado; diferencia = nominal − real.
create or replace function public.exchange_rate_effect(p_from date, p_to date)
returns table (
  source text,
  method_name text,
  payments_count integer,
  nominal_usdt numeric,
  real_usdt numeric,
  difference_usdt numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (p_from::timestamp at time zone 'America/Caracas') as start_at,
           ((p_to + 1)::timestamp at time zone 'America/Caracas') as end_at
  )
  select 'sale', pm.name, count(*)::integer,
         round(sum(sp.usd_amount * sp.usd_usdt_rate), 6),
         round(sum(sp.usdt_value), 6),
         round(sum(sp.usdt_value - sp.usd_amount * sp.usd_usdt_rate), 6)
  from public.sale_payments sp
  join public.payment_methods pm on pm.id = sp.payment_method_id
  cross join bounds b
  where sp.currency = 'VES'
    and sp.occurred_at >= b.start_at and sp.occurred_at < b.end_at
    and not exists (select 1 from public.sale_voids v where v.sale_id = sp.sale_id)
    and public.has_role(array['owner', 'admin']::public.app_role[])
  group by pm.name
  union all
  select 'purchase',
         case pp.rate_kind when 'parallel' then 'Pagos a proveedores · tasa paralela' else 'Pagos a proveedores · tasa BCV' end,
         count(*)::integer,
         round(sum(pp.usd_amount * pp.usd_usdt_rate), 6),
         round(sum(pp.usdt_value), 6),
         round(sum(pp.usd_amount * pp.usd_usdt_rate - pp.usdt_value), 6)
  from public.purchase_payments pp
  cross join bounds b
  where pp.currency = 'VES'
    and pp.occurred_at >= b.start_at and pp.occurred_at < b.end_at
    and not exists (select 1 from public.purchase_voids v where v.purchase_id = pp.purchase_id)
    and public.has_role(array['owner', 'admin']::public.app_role[])
  group by pp.rate_kind;
$$;

-- ============================================================
-- Reserva: lo que entró de verdad a la cuenta de reserva en el período
-- ============================================================

create or replace function public.reserve_activity(p_from date, p_to date)
returns table (
  account_id uuid,
  account_name text,
  transferred_usdt numeric,
  balance_usdt numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.name,
    -- Traspasos que entraron en el período (un traspaso anulado entra como negativo y resta).
    coalesce(sum(l.amount) filter (
      where l.entry_type = 'transfer_in'
        and l.occurred_at >= (p_from::timestamp at time zone 'America/Caracas')
        and l.occurred_at < ((p_to + 1)::timestamp at time zone 'America/Caracas')
    ), 0),
    coalesce(sum(l.amount), 0)
  from public.profit_policy pol
  join public.accounts a on a.id = pol.reserve_account_id
  left join public.ledger_entries l on l.account_id = a.id
  where public.has_role(array['owner', 'admin']::public.app_role[])
  group by a.id, a.name;
$$;

-- ============================================================
-- Permisos
-- ============================================================

revoke all on table public.profit_policy from anon, authenticated;
grant select on public.profit_policy to authenticated;
grant update (reserve_account_id, reserve_percent, reinvestment_percent) on public.profit_policy to authenticated;

revoke execute on function public.profit_policy_validate() from public, anon, authenticated;

revoke execute on function
  public.cash_flow_by_account(date, date),
  public.product_sales_margin(date, date),
  public.exchange_rate_effect(date, date),
  public.reserve_activity(date, date)
from public, anon;

grant execute on function
  public.cash_flow_by_account(date, date),
  public.product_sales_margin(date, date),
  public.exchange_rate_effect(date, date),
  public.reserve_activity(date, date)
to authenticated;
