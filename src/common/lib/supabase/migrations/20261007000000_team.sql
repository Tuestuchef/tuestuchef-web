-- Fase 2 · Equipo: personas, acuerdos de sueldo, pagos y adelantos.
-- Modelo en docs/modelo-de-datos.md (sección 8).
-- - team_members: quienes cobran, tengan o no cuenta en el sistema (vínculo opcional a profiles).
-- - Sueldos versionados (salary_agreements): monto, moneda y frecuencia desde una fecha.
-- - Pagos y adelantos van al libro con categoría salary; el adelanto queda pendiente hasta
--   que un pago lo descuenta. Los retiros del dueño siguen siendo withdrawal.
-- - Todo lo de equipo: solo owner y admin (RLS). Nada se borra; los registros de pago son inmutables.
-- - ledger_entries.team_member_id: la persona de sueldos y retiros. person_id (usuario) se sigue
--   aceptando y se vinculan solos cuando la persona tiene cuenta.

create type public.salary_frequency as enum ('weekly', 'biweekly', 'monthly');
create type public.payroll_entry_kind as enum ('payment', 'advance');

-- ============================================================
-- Personas del equipo
-- ============================================================

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  -- Usuario del sistema, si tiene cuenta. Uno a uno.
  profile_id uuid unique references public.profiles (id),
  job_title text check (job_title is null or length(job_title) <= 80),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  notes text check (notes is null or length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger team_members_created_audit before insert on public.team_members
  for each row execute function public.set_created_audit();
create trigger team_members_updated_audit before update on public.team_members
  for each row execute function public.set_updated_audit();

-- Cada usuario existente pasa a ser persona del equipo (vinculada a su cuenta).
insert into public.team_members (full_name, profile_id, is_active, created_by)
select coalesce(nullif(trim(full_name), ''), 'Sin nombre'), id, is_active, id
from public.profiles;

alter table public.ledger_entries add column team_member_id uuid references public.team_members (id);
create index ledger_entries_team_member_idx on public.ledger_entries (team_member_id) where team_member_id is not null;

-- ============================================================
-- Sueldos (versionados: un cambio es una fila nueva)
-- ============================================================

create table public.salary_agreements (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members (id),
  amount numeric(20, 2) not null check (amount > 0),
  currency public.currency not null,
  frequency public.salary_frequency not null,
  effective_from date not null,
  notes text check (notes is null or length(notes) <= 300),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index salary_agreements_member_idx on public.salary_agreements (team_member_id, effective_from desc, created_at desc);

create trigger salary_agreements_created_audit before insert on public.salary_agreements
  for each row execute function public.set_created_audit();
create trigger salary_agreements_immutable before update or delete on public.salary_agreements
  for each row execute function public.prevent_mutation();
create trigger salary_agreements_no_truncate before truncate on public.salary_agreements
  for each statement execute function public.prevent_mutation();

-- ============================================================
-- Pagos y adelantos
-- ============================================================

create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members (id),
  kind public.payroll_entry_kind not null,
  ledger_entry_id uuid not null unique references public.ledger_entries (id),
  -- Lo que salió, en la moneda de la cuenta.
  currency public.currency not null,
  amount numeric(20, 2) not null check (amount > 0),
  -- Equivalente en USD de referencia (Bs con BCV de la fecha; USDT ÷ usd_usdt).
  usd_amount numeric(20, 6) not null check (usd_amount > 0),
  -- Pago: período que cubre (texto libre, p. ej. "1–15 oct").
  period_label text check (period_label is null or length(period_label) <= 60),
  occurred_at timestamptz not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index payroll_entries_member_idx on public.payroll_entries (team_member_id, occurred_at desc);

-- Qué adelantos descontó cada pago. Un adelanto se descuenta una sola vez.
create table public.payroll_advance_settlements (
  advance_entry_id uuid primary key references public.payroll_entries (id),
  payment_entry_id uuid not null references public.payroll_entries (id),
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['payroll_entries', 'payroll_advance_settlements']
  loop
    execute format('create trigger %1$s_immutable before update or delete on public.%1$s for each row execute function public.prevent_mutation()', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;

-- ============================================================
-- Libro: persona del equipo (reemplaza la función; cambios marcados con «equipo»)
-- ============================================================

create or replace function public.ledger_entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_category public.movement_categories;
  v_original public.ledger_entries;
  v_rate public.exchange_rates;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();

  -- Reverso: copia todo del original con el monto opuesto.
  if new.reverses_entry_id is not null then
    select * into v_original from public.ledger_entries where id = new.reverses_entry_id;
    if not found then
      raise exception 'El movimiento a revertir no existe.';
    end if;
    if v_original.reverses_entry_id is not null then
      raise exception 'Un reverso no se puede revertir.';
    end if;
    if exists (select 1 from public.ledger_entries where reverses_entry_id = v_original.id) then
      raise exception 'Este movimiento ya fue revertido.';
    end if;
    if v_original.transfer_id is not null
       and coalesce(current_setting('app.reversing_transfer', true), '') <> v_original.transfer_id::text then
      raise exception 'Las filas de un traspaso no se revierten sueltas: anula el traspaso completo.';
    end if;
    if coalesce(trim(new.description), '') = '' then
      raise exception 'Indica el motivo del reverso.';
    end if;

    new.account_id := v_original.account_id;
    new.entry_type := v_original.entry_type;
    new.category_id := v_original.category_id;
    new.person_id := v_original.person_id;
    new.team_member_id := v_original.team_member_id; -- «equipo»
    new.transfer_id := v_original.transfer_id;
    new.amount := -v_original.amount;
    new.currency := v_original.currency;
    new.bcv_usd_rate := v_original.bcv_usd_rate;
    new.binance_rate := v_original.binance_rate;
    new.usd_usdt_rate := v_original.usd_usdt_rate;
    new.usdt_value := -v_original.usdt_value;
    new.occurred_at := v_original.occurred_at;
    return new;
  end if;

  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'La fecha del movimiento no puede ser futura.';
  end if;

  select * into v_account from public.accounts where id = new.account_id;
  if not found then
    raise exception 'La cuenta no existe.';
  end if;
  if not v_account.is_active then
    raise exception 'La cuenta "%" está inactiva.', v_account.name;
  end if;
  new.currency := v_account.currency;

  -- Filas de traspaso: solo desde create_account_transfer.
  if new.transfer_id is not null
     or new.entry_type in ('transfer_out', 'transfer_in', 'exchange_fee') then
    if new.transfer_id is null
       or coalesce(current_setting('app.creating_transfer', true), '') <> new.transfer_id::text then
      raise exception 'Los traspasos y sus comisiones se registran con create_account_transfer.';
    end if;
    if new.entry_type not in ('transfer_out', 'transfer_in', 'exchange_fee') then
      raise exception 'Tipo de movimiento inválido para un traspaso.';
    end if;
  end if;

  -- Pagos de venta: solo desde el módulo de ventas.
  if new.entry_type = 'sale_payment'
     and coalesce(current_setting('app.creating_sale_payment', true), '') = '' then
    raise exception 'Los pagos de venta se registran desde el módulo de ventas.';
  end if;

  -- «compras» Pagos a proveedores: solo desde el módulo de compras.
  if new.entry_type = 'purchase_payment'
     and coalesce(current_setting('app.creating_purchase_payment', true), '') = '' then
    raise exception 'Los pagos de compras se registran desde el módulo de compras.';
  end if;

  -- Categoría según el tipo de movimiento.
  if new.entry_type in ('transfer_out', 'transfer_in') then
    if new.category_id is not null then
      raise exception 'Los traspasos no llevan categoría.';
    end if;
  else
    if new.category_id is null then
      raise exception 'Elige una categoría.';
    end if;
    select * into v_category from public.movement_categories where id = new.category_id;
    if not found then
      raise exception 'La categoría no existe.';
    end if;
    if not v_category.is_active then
      raise exception 'La categoría "%" está inactiva.', v_category.name;
    end if;
    if not (
      (new.entry_type = 'income'
        and v_category.type in ('sales', 'other_income', 'capital_contribution'))
      or (new.entry_type = 'expense'
        and v_category.type in ('cost', 'operating_expense', 'exchange_fee', 'tax',
                                'salary', 'withdrawal', 'reinvestment', 'profit_distribution'))
      or (new.entry_type = 'sale_payment' and v_category.type = 'sales')
      -- «compras»
      or (new.entry_type = 'purchase_payment'
        and v_category.type in ('cost', 'operating_expense', 'reinvestment', 'tax'))
      or (new.entry_type = 'exchange_fee' and v_category.type = 'exchange_fee')
    ) then
      raise exception 'La categoría "%" no corresponde a un movimiento de tipo %.',
        v_category.name, new.entry_type;
    end if;
  end if;

  -- «equipo» Persona del equipo y usuario se vinculan solos cuando la persona tiene cuenta.
  if new.team_member_id is null and new.person_id is not null then
    select id into new.team_member_id from public.team_members where profile_id = new.person_id;
  elsif new.person_id is null and new.team_member_id is not null then
    select profile_id into new.person_id from public.team_members where id = new.team_member_id;
  end if;

  -- Persona: obligatoria en sueldos, retiros, aportes y distribuciones; vacía en el resto.
  if v_category.id is not null and public.category_type_requires_person(v_category.type) then
    if new.person_id is null and new.team_member_id is null then
      raise exception 'Indica la persona para "%".', v_category.name;
    end if;
  elsif new.person_id is not null or new.team_member_id is not null then
    raise exception 'Este movimiento no lleva persona.';
  end if;

  -- Signo: ingresos en positivo, egresos en negativo. La comisión de cambio admite ambos.
  if (new.entry_type in ('income', 'sale_payment', 'transfer_in') and new.amount < 0)
     or (new.entry_type in ('expense', 'transfer_out', 'purchase_payment') and new.amount > 0) then
    raise exception 'Signo inválido: los ingresos van en positivo y los egresos en negativo.';
  end if;

  -- Tasas: las enviadas o la última registrada.
  if new.bcv_usd_rate is null or new.binance_rate is null or new.usd_usdt_rate is null then
    v_rate := public.require_latest_exchange_rate();
    new.bcv_usd_rate := coalesce(new.bcv_usd_rate, v_rate.bcv_usd);
    new.binance_rate := coalesce(new.binance_rate, v_rate.binance_usdt);
    new.usd_usdt_rate := coalesce(new.usd_usdt_rate, v_rate.usd_usdt);
  end if;

  new.usdt_value := public.to_usdt(new.amount, new.currency, new.binance_rate, new.usd_usdt_rate);
  return new;
end;
$$;

-- Staff no registra movimientos con persona (sueldos, retiros…).
drop policy "ledger_entries: staff registra ingresos y gastos permitidos" on public.ledger_entries;

create policy "ledger_entries: staff registra ingresos y gastos permitidos"
on public.ledger_entries for insert
to authenticated
with check (
  public.has_role(array['staff']::public.app_role[])
  and entry_type in ('income', 'expense')
  and transfer_id is null
  and person_id is null
  and team_member_id is null
  and reverses_entry_id is null
  and public.staff_can_use_category(category_id)
);

grant insert (team_member_id) on public.ledger_entries to authenticated;

-- ============================================================
-- Funciones de nómina (owner y admin)
-- ============================================================

-- Inserta el movimiento en el libro y su registro de nómina. Interna.
create or replace function public.insert_payroll_entry(
  p_kind public.payroll_entry_kind,
  p_team_member_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_period_label text,
  p_note text,
  p_occurred_at timestamptz,
  p_receipt_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.team_members;
  v_category_id uuid;
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_entry public.ledger_entries;
  v_usd numeric;
  v_id uuid;
  v_label text;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin registran pagos al equipo.' using errcode = '42501';
  end if;
  select * into v_member from public.team_members where id = p_team_member_id;
  if not found then
    raise exception 'La persona no existe.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;

  -- Categoría de sueldos: la de sistema si existe; si no, la primera activa de tipo salary.
  select id into v_category_id from public.movement_categories
  where type = 'salary' and is_active order by is_system desc, created_at limit 1;
  if v_category_id is null then
    raise exception 'Crea una categoría de tipo Sueldo en Categorías de dinero.';
  end if;

  v_label := case p_kind when 'advance' then 'Adelanto' else 'Pago de sueldo' end
    || ' · ' || v_member.full_name
    || coalesce(' · ' || nullif(trim(p_period_label), ''), '')
    || coalesce(' · ' || nullif(trim(p_note), ''), '');

  -- El libro aplica fecha, tasas de esa fecha y límites (ledger_entries_backdate_rates).
  insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, description, team_member_id, receipt_path)
  values (p_account_id, 'expense', v_category_id, -p_amount, v_at, left(v_label, 300), p_team_member_id, p_receipt_path)
  returning * into v_entry;

  v_usd := round(
    case v_entry.currency
      when 'VES' then p_amount / v_entry.bcv_usd_rate
      when 'USDT' then p_amount / v_entry.usd_usdt_rate
      else p_amount
    end,
    6
  );

  insert into public.payroll_entries (team_member_id, kind, ledger_entry_id, currency, amount, usd_amount, period_label, occurred_at)
  values (p_team_member_id, p_kind, v_entry.id, v_entry.currency, p_amount, v_usd, nullif(trim(p_period_label), ''), v_entry.occurred_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- Adelanto: queda pendiente hasta que un pago lo descuente.
create or replace function public.register_salary_advance(
  p_team_member_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_note text default null,
  p_occurred_at timestamptz default null,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.insert_payroll_entry('advance', p_team_member_id, p_account_id, p_amount, null, p_note, p_occurred_at, p_receipt_path);
end;
$$;

-- Pago de sueldo: lo pagado (neto) + los adelantos que descuenta (por defecto, todos los pendientes).
create or replace function public.register_salary_payment(
  p_team_member_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_period_label text default null,
  p_settle_advance_ids uuid[] default null,
  p_note text default null,
  p_occurred_at timestamptz default null,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_advance record;
  v_count integer := 0;
begin
  v_payment_id := public.insert_payroll_entry(
    'payment', p_team_member_id, p_account_id, p_amount, p_period_label, p_note, p_occurred_at, p_receipt_path
  );

  for v_advance in
    select e.id
    from public.payroll_entries e
    where e.team_member_id = p_team_member_id
      and e.kind = 'advance'
      and not exists (select 1 from public.payroll_advance_settlements s where s.advance_entry_id = e.id)
      and not exists (select 1 from public.ledger_entries r where r.reverses_entry_id = e.ledger_entry_id)
      and (p_settle_advance_ids is null or e.id = any (p_settle_advance_ids))
    for update
  loop
    insert into public.payroll_advance_settlements (advance_entry_id, payment_entry_id) values (v_advance.id, v_payment_id);
    v_count := v_count + 1;
  end loop;

  if p_settle_advance_ids is not null and v_count <> cardinality(p_settle_advance_ids) then
    raise exception 'Alguno de los adelantos no es de esta persona o ya fue descontado.';
  end if;

  return v_payment_id;
end;
$$;

-- ============================================================
-- Vistas (owner y admin)
-- ============================================================

-- Sueldo vigente de cada persona: el último acuerdo con fecha de hoy o anterior.
create view public.current_salary_agreements
with (security_invoker = true)
as
select distinct on (a.team_member_id) a.*
from public.salary_agreements a
where a.effective_from <= public.caracas_today()
order by a.team_member_id, a.effective_from desc, a.created_at desc;

-- Adelantos pendientes (no descontados ni revertidos).
create view public.pending_salary_advances
with (security_invoker = true)
as
select e.*
from public.payroll_entries e
where e.kind = 'advance'
  and not exists (select 1 from public.payroll_advance_settlements s where s.advance_entry_id = e.id)
  and not exists (select 1 from public.ledger_entries r where r.reverses_entry_id = e.ledger_entry_id);

-- ============================================================
-- Analítica: el nombre de la persona sale del equipo (con o sin cuenta)
-- ============================================================

create or replace function public.analytics_ledger_summary(p_from date, p_to date)
returns table (
  month text,
  category_type public.category_type,
  category_name text,
  person_name text,
  usdt_value numeric
)
language sql
stable
set search_path = ''
as $$
  select
    to_char(l.occurred_at at time zone 'America/Caracas', 'YYYY-MM') as month,
    c.type as category_type,
    c.name as category_name,
    coalesce(t.full_name, p.full_name) as person_name,
    sum(l.usdt_value) as usdt_value
  from public.ledger_entries l
  join public.movement_categories c on c.id = l.category_id
  left join public.team_members t on t.id = l.team_member_id
  left join public.profiles p on p.id = l.person_id
  where l.occurred_at >= (p_from::timestamp at time zone 'America/Caracas')
    and l.occurred_at < ((p_to + 1)::timestamp at time zone 'America/Caracas')
  group by 1, 2, 3, 4
  order by 1, 2, 3;
$$;

-- ============================================================
-- RLS y permisos: todo lo de equipo es de owner y admin.
-- ============================================================

alter table public.team_members enable row level security;

create policy "team_members: owner y admin ven"
on public.team_members for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "team_members: owner y admin crean"
on public.team_members for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "team_members: owner y admin editan"
on public.team_members for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

alter table public.salary_agreements enable row level security;

create policy "salary_agreements: owner y admin ven"
on public.salary_agreements for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "salary_agreements: owner y admin registran"
on public.salary_agreements for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

do $$
declare
  t text;
begin
  foreach t in array array['payroll_entries', 'payroll_advance_settlements']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: owner y admin ven" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
  end loop;
end;
$$;

revoke all on table
  public.team_members, public.salary_agreements, public.payroll_entries, public.payroll_advance_settlements,
  public.current_salary_agreements, public.pending_salary_advances
from anon, authenticated;

grant select on public.team_members to authenticated;
grant insert (full_name, profile_id, job_title, phone, notes, is_active),
      update (full_name, profile_id, job_title, phone, notes, is_active)
  on public.team_members to authenticated;
grant select on public.salary_agreements to authenticated;
grant insert (team_member_id, amount, currency, frequency, effective_from, notes) on public.salary_agreements to authenticated;
grant select on public.payroll_entries, public.payroll_advance_settlements,
  public.current_salary_agreements, public.pending_salary_advances to authenticated;

revoke execute on function
  public.insert_payroll_entry(public.payroll_entry_kind, uuid, uuid, numeric, text, text, timestamptz, text)
from public, anon, authenticated;

revoke execute on function
  public.register_salary_advance(uuid, uuid, numeric, text, timestamptz, text),
  public.register_salary_payment(uuid, uuid, numeric, text, uuid[], text, timestamptz, text)
from public, anon;

grant execute on function
  public.register_salary_advance(uuid, uuid, numeric, text, timestamptz, text),
  public.register_salary_payment(uuid, uuid, numeric, text, uuid[], text, timestamptz, text)
to authenticated;
