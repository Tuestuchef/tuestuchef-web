-- Fase 3, paso 3: cierre de período.
--
-- Cerrar un mes congela sus números: nada con fecha dentro de un mes cerrado se puede registrar,
-- para ningún rol (ventas, pagos, compras, movimientos, traspasos, sueldos, stock ni reversos).
-- Cierran owner y admin (solo meses ya terminados); reabre solo el owner, con motivo.
-- Cada cierre guarda una foto de la utilidad del mes.

create type public.period_close_action as enum ('close', 'reopen');

create table public.period_close_events (
  id uuid primary key default gen_random_uuid(),
  -- Primer día del mes.
  period date not null check (extract(day from period) = 1),
  action public.period_close_action not null,
  reason text check (reason is null or length(trim(reason)) between 3 and 300),
  -- Al cerrar: totales en USDT por tipo de categoría.
  totals_snapshot jsonb,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  constraint period_close_events_reopen_reason check (action = 'close' or reason is not null)
);
create index period_close_events_period_idx on public.period_close_events (period, created_at desc);

create trigger period_close_events_immutable before update or delete on public.period_close_events
  for each row execute function public.prevent_mutation();
create trigger period_close_events_no_truncate before truncate on public.period_close_events
  for each statement execute function public.prevent_mutation();

-- ¿Está cerrado el mes de esta fecha? (el último evento manda)
create or replace function public.is_period_closed(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select action = 'close' from public.period_close_events
     where period = date_trunc('month', p_date)::date
     order by created_at desc, id desc limit 1),
    false
  );
$$;

create or replace function public.assert_period_open(p_occurred_at timestamptz)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date := (p_occurred_at at time zone 'America/Caracas')::date;
begin
  if public.is_period_closed(v_date) then
    raise exception 'El mes de % está cerrado: no se registra nada con esa fecha. El owner puede reabrirlo.',
      to_char(v_date, 'MM/YYYY');
  end if;
end;
$$;

-- Ventas, pagos, compras y producción ya pasan por check_occurred_at: ahora también exige mes abierto.
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
  perform public.assert_period_open(p_occurred_at);
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

-- Red de seguridad: todo movimiento de dinero o de stock (incluidos traspasos, sueldos,
-- reembolsos y reversos, que copian la fecha del original) respeta el cierre.
create or replace function public.guard_closed_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_period_open(coalesce(new.occurred_at, now()));
  return new;
end;
$$;

create trigger ledger_entries_guard_closed_period before insert on public.ledger_entries
  for each row execute function public.guard_closed_period();
create trigger stock_movements_guard_closed_period before insert on public.stock_movements
  for each row execute function public.guard_closed_period();
create trigger account_transfers_guard_closed_period before insert on public.account_transfers
  for each row execute function public.guard_closed_period();

-- Totales del mes por tipo de categoría, en USDT (la foto del cierre).
create or replace function public.period_totals(p_period date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(category_type, total), '{}')
  from (
    select c.type as category_type, round(sum(l.usdt_value), 2) as total
    from public.ledger_entries l
    join public.movement_categories c on c.id = l.category_id
    where l.occurred_at >= (p_period::timestamp at time zone 'America/Caracas')
      and l.occurred_at < ((p_period + interval '1 month')::timestamp at time zone 'America/Caracas')
    group by c.type
  ) t;
$$;

-- Cerrar un mes terminado: owner y admin.
create or replace function public.close_period(p_period date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin cierran períodos.' using errcode = '42501';
  end if;
  if v_period >= date_trunc('month', public.caracas_today())::date then
    raise exception 'Solo se cierran meses ya terminados.';
  end if;
  if public.is_period_closed(v_period) then
    raise exception 'Ese mes ya está cerrado.';
  end if;
  insert into public.period_close_events (period, action, totals_snapshot)
  values (v_period, 'close', public.period_totals(v_period));
end;
$$;

-- Reabrir: solo el owner, con motivo. Queda registrado.
create or replace function public.reopen_period(p_period date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
begin
  if not public.has_role(array['owner']::public.app_role[]) then
    raise exception 'Solo el owner reabre un período cerrado.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo.';
  end if;
  if not public.is_period_closed(v_period) then
    raise exception 'Ese mes no está cerrado.';
  end if;
  insert into public.period_close_events (period, action, reason) values (v_period, 'reopen', trim(p_reason));
end;
$$;

-- Estado de cada mes con eventos (el último manda).
create view public.period_status
with (security_invoker = true)
as
select distinct on (e.period)
  e.period,
  (e.action = 'close') as is_closed,
  e.created_at as changed_at,
  e.created_by as changed_by,
  e.reason,
  e.totals_snapshot
from public.period_close_events e
order by e.period, e.created_at desc, e.id desc;

-- RLS: solo owner y admin ven los cierres (staff solo recibe el error al intentar registrar).
alter table public.period_close_events enable row level security;
create policy "period_close_events: owner y admin" on public.period_close_events for select to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));
revoke all on table public.period_close_events, public.period_status from anon, authenticated;
grant select on table public.period_close_events, public.period_status to authenticated;

revoke all on function
  public.guard_closed_period(),
  public.period_totals(date)
from public, anon, authenticated;
revoke all on function
  public.is_period_closed(date),
  public.assert_period_open(timestamptz),
  public.close_period(date),
  public.reopen_period(date, text)
from public, anon;
grant execute on function
  public.is_period_closed(date),
  public.close_period(date),
  public.reopen_period(date, text)
to authenticated;
