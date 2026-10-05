-- Fase 3, paso 4: recordatorios y avisos (correo y push).
--
-- Owner y admin prenden o apagan cada aviso y cada canal (correo, push), eligen quién recibe
-- cada uno (por rol) y la anticipación de los que avisan antes de vencer. Un resumen diario
-- (cron) junta lo pendiente de cada aviso y lo manda a cada persona; el registro evita repetir.

create type public.notification_kind as enum (
  'late_orders',
  'late_workshops',
  'missing_rate',
  'receivables_due',
  'payables_due',
  'low_stock'
);
create type public.notification_channel as enum ('email', 'push');
create type public.notification_status as enum ('sent', 'failed');

-- Interruptores generales por canal.
create table public.notification_channel_settings (
  id boolean primary key default true check (id),
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
insert into public.notification_channel_settings default values;

-- Cada aviso: prendido o no, por qué canales, para qué roles y con cuánta anticipación.
create table public.notification_settings (
  kind public.notification_kind primary key,
  enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  roles public.app_role[] not null default '{owner,admin}' check (cardinality(roles) >= 1),
  -- Por cobrar: días de deuda para avisar. Por pagar: días antes del vencimiento.
  lead_days integer not null default 3 check (lead_days between 0 and 90),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
insert into public.notification_settings (kind, roles, lead_days) values
  ('late_orders', '{owner,admin,staff}', 0),
  ('late_workshops', '{owner,admin,staff}', 0),
  ('missing_rate', '{owner,admin}', 0),
  ('receivables_due', '{owner,admin}', 7),
  ('payables_due', '{owner,admin}', 3),
  ('low_stock', '{owner,admin,staff}', 0);

-- Tablas de configuración (sin created_by): solo quién y cuándo cambió.
create or replace function public.set_settings_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_channel_settings_updated_audit before update on public.notification_channel_settings
  for each row execute function public.set_settings_audit();
create trigger notification_settings_updated_audit before update on public.notification_settings
  for each row execute function public.set_settings_audit();

-- Corrige order_settings (paso 2): usaba el trigger de tablas con created_by y fallaba al guardar.
drop trigger order_settings_updated_audit on public.order_settings;
create trigger order_settings_updated_audit before update on public.order_settings
  for each row execute function public.set_settings_audit();

-- Dispositivos con push activado, de cada persona.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

-- Lo enviado: uno por persona, aviso, canal y clave (día), para no repetir.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  kind public.notification_kind not null,
  channel public.notification_channel not null,
  dedupe_key text not null,
  title text not null,
  body text not null,
  url text,
  status public.notification_status not null,
  error text,
  created_at timestamptz not null default now(),
  constraint notification_log_unique unique (profile_id, kind, channel, dedupe_key)
);
create index notification_log_profile_idx on public.notification_log (profile_id, created_at desc);
create trigger notification_log_immutable before update or delete on public.notification_log
  for each row execute function public.prevent_mutation();

-- Lo pendiente de un aviso, hoy. Solo la llama el servidor con la clave de servicio.
create or replace function public.notification_items(p_kind public.notification_kind)
returns table (item_key text, title text, detail text, url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.caracas_today();
  v_lead integer;
begin
  select lead_days into v_lead from public.notification_settings where kind = p_kind;

  if p_kind = 'late_orders' then
    return query
      select o.sale_id::text,
             'NE-' || lpad(o.number::text, 6, '0') || ' · ' || coalesce(trim(c.first_name || ' ' || coalesce(c.last_name, '')), 'sin cliente'),
             'Prometido el ' || to_char(o.promised_date, 'DD/MM') || ' (' || (v_today - o.promised_date) || ' días de atraso)',
             '/pedidos/' || o.sale_id
      from public.orders_overview o
      left join public.customers c on c.id = o.customer_id
      where o.is_late
      order by o.promised_date;

  elsif p_kind = 'late_workshops' then
    return query
      select q.assignment_id::text,
             s.name || ' · NE-' || lpad(q.number::text, 6, '0'),
             'Debía entregar el ' || to_char(q.expected_date, 'DD/MM'),
             '/pedidos/' || q.sale_id
      from public.production_queue q
      join public.suppliers s on s.id = q.supplier_id
      where q.workshop_late
      order by q.expected_date;

  elsif p_kind = 'missing_rate' then
    return query
      select v_today::text, 'Falta la tasa de hoy', 'Regístrala en Tasas y cuentas para poder cobrar en Bs.', '/cuentas'
      where public.exchange_rate_for_date(v_today) is null
         or (public.exchange_rate_for_date(v_today)).id is null;

  elsif p_kind = 'receivables_due' then
    return query
      select ss.sale_id::text,
             'NE-' || lpad(ss.number::text, 6, '0') || ' · ' || coalesce(trim(c.first_name || ' ' || coalesce(c.last_name, '')), 'venta rápida'),
             'Debe ' || to_char(ss.balance_usd, 'FM999G999G990D00') || ' USD desde hace ' || (v_today - (ss.occurred_at at time zone 'America/Caracas')::date) || ' días',
             '/ventas/' || ss.sale_id
      from public.sales_summary ss
      left join public.customers c on c.id = ss.customer_id
      where ss.payment_status in ('pending', 'partial')
        and ss.balance_usd > 0.01
        and v_today - (ss.occurred_at at time zone 'America/Caracas')::date >= v_lead
        -- Los pedidos abiertos cobran el resto al entregar: no son deudas todavía.
        and not exists (select 1 from public.orders o where o.sale_id = ss.sale_id and o.delivered_at is null)
      order by ss.occurred_at;

  elsif p_kind = 'payables_due' then
    return query
      select ps.purchase_id::text,
             'C-' || lpad(ps.number::text, 6, '0') || ' · ' || sp.name,
             case when ps.due_date < v_today then 'Vencida desde el ' else 'Vence el ' end || to_char(ps.due_date, 'DD/MM')
               || ' · saldo ' || to_char(ps.balance_usd, 'FM999G999G990D00') || ' USD',
             '/compras/' || ps.purchase_id
      from public.purchases_summary ps
      join public.suppliers sp on sp.id = ps.supplier_id
      where ps.balance_usd > 0.01
        and ps.payment_status <> 'voided'
        and ps.due_date is not null
        and ps.due_date <= v_today + v_lead
      order by ps.due_date;

  elsif p_kind = 'low_stock' then
    return query
      select b.variant_id::text,
             p.name || ' · ' || b.sku,
             'Quedan ' || trim_scale(b.quantity) || ' (mínimo ' || trim_scale(b.min_stock) || ')',
             '/productos/' || p.id
      from public.stock_balances b
      join public.products p on p.id = b.product_id
      where b.is_low and p.is_active
      order by p.name, b.sku;
  end if;
end;
$$;

-- RLS
alter table public.notification_channel_settings enable row level security;
alter table public.notification_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

create policy "notification_channel_settings: owner y admin ven" on public.notification_channel_settings for select to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "notification_channel_settings: owner y admin editan" on public.notification_channel_settings for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "notification_settings: owner y admin ven" on public.notification_settings for select to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "notification_settings: owner y admin editan" on public.notification_settings for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- Cada persona maneja sus propios dispositivos.
create policy "push_subscriptions: los propios" on public.push_subscriptions for select to authenticated
  using (profile_id = auth.uid());
create policy "push_subscriptions: registrar el propio" on public.push_subscriptions for insert to authenticated
  with check (profile_id = auth.uid() and public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "push_subscriptions: quitar el propio" on public.push_subscriptions for delete to authenticated
  using (profile_id = auth.uid());

-- Cada persona ve sus avisos; owner y admin ven todos.
create policy "notification_log: los propios" on public.notification_log for select to authenticated
  using (profile_id = auth.uid() or public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.notification_channel_settings, public.notification_settings, public.push_subscriptions, public.notification_log
  from anon, authenticated;
grant select on table public.notification_channel_settings, public.notification_settings, public.push_subscriptions, public.notification_log
  to authenticated;
grant update (email_enabled, push_enabled) on public.notification_channel_settings to authenticated;
grant update (enabled, email_enabled, push_enabled, roles, lead_days) on public.notification_settings to authenticated;
grant insert (endpoint, p256dh, auth, user_agent), delete on public.push_subscriptions to authenticated;

-- Solo el servidor (clave de servicio) arma los avisos.
revoke all on function public.notification_items(public.notification_kind) from public, anon, authenticated;
grant execute on function public.notification_items(public.notification_kind) to service_role;
