-- Treasury: tasas, cuentas, categorías de movimiento, métodos de pago,
-- traspasos y el libro de movimientos. Modelo completo en docs/modelo-de-datos.md.
--
-- Reglas que se aplican aquí:
-- - El saldo de una cuenta es la suma del libro. No existe columna de saldo.
-- - Tasas, libro y traspasos son inmutables: se corrige con reversos.
-- - usdt_value lo calcula la base al insertar y nunca se recalcula.
-- - Staff solo usa categorías sales y operating_expense (RLS).

-- ============================================================
-- Tipos
-- ============================================================

create type public.currency as enum ('VES', 'USD', 'USDT');

create type public.account_kind as enum ('bank', 'cash', 'zelle', 'crypto_wallet');

create type public.category_type as enum (
  'sales',
  'other_income',
  'capital_contribution',
  'cost',
  'operating_expense',
  'exchange_fee',
  'tax',
  'salary',
  'withdrawal',
  'reinvestment',
  'profit_distribution'
);

create type public.category_scope as enum ('business', 'personal');

create type public.ledger_entry_type as enum (
  'income',
  'expense',
  'sale_payment',
  'transfer_out',
  'transfer_in',
  'exchange_fee'
);

-- ============================================================
-- Helpers generales (también los usarán products y sales)
-- ============================================================

-- "Hoy" en Venezuela.
create function public.caracas_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Caracas')::date;
$$;

-- created_by siempre es el usuario de la sesión: no se puede suplantar.
-- Sin sesión (service role, migraciones, seed) se respeta el valor enviado.
create function public.set_created_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  return new;
end;
$$;

create function public.set_updated_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

-- Tablas inmutables: nadie edita ni borra, ni siquiera con service role.
create function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los registros de % no se editan ni se borran: se corrigen con un reverso.', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

-- Valor real en USDT: VES ÷ Binance, USD × usd_usdt, USDT tal cual.
create function public.to_usdt(
  p_amount numeric,
  p_currency public.currency,
  p_binance_rate numeric,
  p_usd_usdt_rate numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(
    case p_currency
      when 'USDT' then p_amount
      when 'USD' then p_amount * p_usd_usdt_rate
      when 'VES' then p_amount / p_binance_rate
    end,
    6
  );
$$;

-- Inverso de to_usdt, redondeado a centavos.
create function public.from_usdt(
  p_usdt numeric,
  p_currency public.currency,
  p_binance_rate numeric,
  p_usd_usdt_rate numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(
    case p_currency
      when 'USDT' then p_usdt
      when 'USD' then p_usdt / p_usd_usdt_rate
      when 'VES' then p_usdt * p_binance_rate
    end,
    2
  );
$$;

-- ============================================================
-- Tasas
-- ============================================================

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null default public.caracas_today(),
  bcv_usd numeric(20, 8) not null check (bcv_usd > 0),
  bcv_eur numeric(20, 8) not null check (bcv_eur > 0),
  binance_usdt numeric(20, 8) not null check (binance_usdt > 0),
  usd_usdt numeric(20, 8) not null default 1 check (usd_usdt > 0),
  note text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.exchange_rates is
  'Historial de tasas (Bs por unidad; usd_usdt = USDT por 1 USD). Corregir = agregar otra fila del mismo día.';

create index exchange_rates_latest_idx on public.exchange_rates (rate_date desc, created_at desc);

create trigger exchange_rates_created_audit
before insert on public.exchange_rates
for each row execute function public.set_created_audit();

create trigger exchange_rates_immutable
before update or delete on public.exchange_rates
for each row execute function public.prevent_mutation();

create trigger exchange_rates_no_truncate
before truncate on public.exchange_rates
for each statement execute function public.prevent_mutation();

-- Tasa vigente: la más reciente cuyo día ya empezó (el BCV publica la del día siguiente por adelantado).
create function public.latest_exchange_rate()
returns public.exchange_rates
language sql
stable
set search_path = ''
as $$
  select *
  from public.exchange_rates
  where rate_date <= public.caracas_today()
  order by rate_date desc, created_at desc
  limit 1;
$$;

create function public.require_latest_exchange_rate()
returns public.exchange_rates
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rate public.exchange_rates;
begin
  select * into v_rate from public.latest_exchange_rate();
  if v_rate.id is null then
    raise exception 'No hay tasa registrada. Registra la tasa del día primero.';
  end if;
  return v_rate;
end;
$$;

create function public.exchange_rate_exists_for(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.exchange_rates where rate_date = p_date);
$$;

create view public.current_exchange_rate
with (security_invoker = true)
as
select *
from public.exchange_rates
where rate_date <= public.caracas_today()
order by rate_date desc, created_at desc
limit 1;

alter table public.exchange_rates enable row level security;

create policy "exchange_rates: todo el equipo las ve"
on public.exchange_rates for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "exchange_rates: owner y admin registran y corrigen"
on public.exchange_rates for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "exchange_rates: staff registra la de hoy si no existe"
on public.exchange_rates for insert
to authenticated
with check (
  public.has_role(array['staff']::public.app_role[])
  and rate_date = public.caracas_today()
  and not public.exchange_rate_exists_for(rate_date)
);

-- ============================================================
-- Cuentas
-- ============================================================

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  currency public.currency not null,
  kind public.account_kind not null,
  is_active boolean not null default true,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint accounts_kind_currency_check check (
    (kind = 'zelle' and currency = 'USD')
    or (kind = 'crypto_wallet' and currency = 'USDT')
    or (kind in ('bank', 'cash') and currency in ('VES', 'USD'))
  )
);

comment on table public.accounts is
  'Cuentas del negocio. Sin columna de saldo: el saldo es la suma de ledger_entries.';

create trigger accounts_created_audit
before insert on public.accounts
for each row execute function public.set_created_audit();

create trigger accounts_updated_audit
before update on public.accounts
for each row execute function public.set_updated_audit();

alter table public.accounts enable row level security;

create policy "accounts: todo el equipo las ve"
on public.accounts for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "accounts: owner y admin crean"
on public.accounts for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "accounts: owner y admin editan"
on public.accounts for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- ============================================================
-- Categorías de movimiento
-- ============================================================

create table public.movement_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  type public.category_type not null,
  -- Solo lo que va o viene del bolsillo de una persona es personal.
  -- Un gasto personal pagado por el negocio es un withdrawal, nunca un gasto del negocio.
  scope public.category_scope not null generated always as (
    case
      when type in ('withdrawal', 'capital_contribution', 'profit_distribution')
        then 'personal'::public.category_scope
      else 'business'::public.category_scope
    end
  ) stored,
  is_system boolean not null default false,
  is_active boolean not null default true,
  -- Vacío solo en categorías de sistema (creadas por la migración).
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint movement_categories_created_by_check check (is_system or created_by is not null)
);

create unique index movement_categories_one_system_per_type
on public.movement_categories (type)
where is_system;

create function public.category_type_requires_person(p_type public.category_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_type in ('salary', 'withdrawal', 'capital_contribution', 'profit_distribution');
$$;

create function public.category_type_staff_allowed(p_type public.category_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_type in ('sales', 'operating_expense');
$$;

create function public.staff_can_use_category(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.category_type_staff_allowed(c.type)
      from public.movement_categories c
      where c.id = p_category_id
    ),
    false
  );
$$;

create function public.movement_categories_protect_system()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_system then
    raise exception 'La categoría "%" es del sistema y no se edita.', old.name;
  end if;
  return new;
end;
$$;

create trigger movement_categories_created_audit
before insert on public.movement_categories
for each row execute function public.set_created_audit();

create trigger movement_categories_protect_system
before update on public.movement_categories
for each row execute function public.movement_categories_protect_system();

create trigger movement_categories_updated_audit
before update on public.movement_categories
for each row execute function public.set_updated_audit();

-- Categorías que usa el sistema.
insert into public.movement_categories (name, type, is_system) values
  ('Ventas', 'sales', true),
  ('Comisión de cambio', 'exchange_fee', true);

alter table public.movement_categories enable row level security;

create policy "movement_categories: owner y admin ven todas"
on public.movement_categories for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "movement_categories: staff ve ventas y gastos operativos"
on public.movement_categories for select
to authenticated
using (
  public.has_role(array['staff']::public.app_role[])
  and public.category_type_staff_allowed(type)
);

create policy "movement_categories: owner y admin crean"
on public.movement_categories for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "movement_categories: owner y admin editan"
on public.movement_categories for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- ============================================================
-- Métodos de pago
-- ============================================================

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  -- Cuenta donde cae el dinero.
  account_id uuid not null references public.accounts (id),
  -- Moneda en que se expresan los precios de este método.
  price_currency public.currency not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger payment_methods_created_audit
before insert on public.payment_methods
for each row execute function public.set_created_audit();

create trigger payment_methods_updated_audit
before update on public.payment_methods
for each row execute function public.set_updated_audit();

alter table public.payment_methods enable row level security;

create policy "payment_methods: todo el equipo los ve"
on public.payment_methods for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "payment_methods: owner y admin crean"
on public.payment_methods for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "payment_methods: owner y admin editan"
on public.payment_methods for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- ============================================================
-- Traspasos y conversiones entre cuentas
-- ============================================================

create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts (id),
  to_account_id uuid not null references public.accounts (id),
  amount_out numeric(20, 2) not null check (amount_out > 0),
  amount_in numeric(20, 2) not null check (amount_in > 0),
  bcv_usd_rate numeric(20, 8) not null check (bcv_usd_rate > 0),
  binance_rate numeric(20, 8) not null check (binance_rate > 0),
  usd_usdt_rate numeric(20, 8) not null check (usd_usdt_rate > 0),
  occurred_at timestamptz not null default now(),
  note text,
  -- Solo la ruta del comprobante en R2, nunca la URL.
  receipt_path text check (receipt_path is null or receipt_path !~* '^[a-z]+://'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint account_transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create function public.account_transfers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate public.exchange_rates;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();

  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'La fecha del traspaso no puede ser futura.';
  end if;

  if exists (
    select 1
    from public.accounts a
    where a.id in (new.from_account_id, new.to_account_id)
      and not a.is_active
  ) then
    raise exception 'No se puede traspasar desde o hacia una cuenta inactiva.';
  end if;

  if new.bcv_usd_rate is null or new.binance_rate is null or new.usd_usdt_rate is null then
    v_rate := public.require_latest_exchange_rate();
    new.bcv_usd_rate := coalesce(new.bcv_usd_rate, v_rate.bcv_usd);
    new.binance_rate := coalesce(new.binance_rate, v_rate.binance_usdt);
    new.usd_usdt_rate := coalesce(new.usd_usdt_rate, v_rate.usd_usdt);
  end if;

  return new;
end;
$$;

create trigger account_transfers_before_insert
before insert on public.account_transfers
for each row execute function public.account_transfers_before_insert();

create trigger account_transfers_immutable
before update or delete on public.account_transfers
for each row execute function public.prevent_mutation();

create trigger account_transfers_no_truncate
before truncate on public.account_transfers
for each statement execute function public.prevent_mutation();

alter table public.account_transfers enable row level security;

create policy "account_transfers: owner y admin ven"
on public.account_transfers for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "account_transfers: owner y admin registran"
on public.account_transfers for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- ============================================================
-- Libro de movimientos
-- ============================================================

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  entry_type public.ledger_entry_type not null,
  category_id uuid references public.movement_categories (id),
  -- Con signo: + entra, − sale. Moneda = la de la cuenta.
  amount numeric(20, 2) not null check (amount <> 0),
  currency public.currency not null,
  bcv_usd_rate numeric(20, 8) not null check (bcv_usd_rate > 0),
  binance_rate numeric(20, 8) not null check (binance_rate > 0),
  usd_usdt_rate numeric(20, 8) not null check (usd_usdt_rate > 0),
  usdt_value numeric(20, 6) not null,
  occurred_at timestamptz not null default now(),
  description text,
  person_id uuid references public.profiles (id),
  transfer_id uuid references public.account_transfers (id),
  reverses_entry_id uuid unique references public.ledger_entries (id),
  receipt_path text check (receipt_path is null or receipt_path !~* '^[a-z]+://'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.ledger_entries is
  'Libro de movimientos: una fila por cada cambio de saldo. Inmutable; se corrige con reversos.';

create index ledger_entries_account_idx on public.ledger_entries (account_id, occurred_at desc);
create index ledger_entries_occurred_idx on public.ledger_entries (occurred_at desc);
create index ledger_entries_category_idx on public.ledger_entries (category_id);
create index ledger_entries_person_idx on public.ledger_entries (person_id) where person_id is not null;
create index ledger_entries_transfer_idx on public.ledger_entries (transfer_id) where transfer_id is not null;
create index ledger_entries_created_by_idx on public.ledger_entries (created_by);

-- Valida, completa tasas y calcula usdt_value. Security definer para validar
-- contra los datos reales; los permisos del INSERT los sigue aplicando RLS.
create function public.ledger_entries_before_insert()
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
    new.transfer_id := v_original.transfer_id;
    new.amount := -v_original.amount;
    new.currency := v_original.currency;
    new.bcv_usd_rate := v_original.bcv_usd_rate;
    new.binance_rate := v_original.binance_rate;
    new.usd_usdt_rate := v_original.usd_usdt_rate;
    new.usdt_value := -v_original.usdt_value;
    -- Misma fecha que el original: el período del error queda corregido.
    -- created_at dice cuándo se corrigió.
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
      or (new.entry_type = 'exchange_fee' and v_category.type = 'exchange_fee')
    ) then
      raise exception 'La categoría "%" no corresponde a un movimiento de tipo %.',
        v_category.name, new.entry_type;
    end if;
  end if;

  -- Persona: obligatoria en sueldos, retiros, aportes y distribuciones; vacía en el resto.
  if v_category.id is not null and public.category_type_requires_person(v_category.type) then
    if new.person_id is null then
      raise exception 'Indica la persona para "%".', v_category.name;
    end if;
  elsif new.person_id is not null then
    raise exception 'Este movimiento no lleva persona.';
  end if;

  -- Signo: ingresos en positivo, egresos en negativo. La comisión de cambio admite ambos.
  if (new.entry_type in ('income', 'sale_payment', 'transfer_in') and new.amount < 0)
     or (new.entry_type in ('expense', 'transfer_out') and new.amount > 0) then
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

create trigger ledger_entries_before_insert
before insert on public.ledger_entries
for each row execute function public.ledger_entries_before_insert();

create trigger ledger_entries_immutable
before update or delete on public.ledger_entries
for each row execute function public.prevent_mutation();

create trigger ledger_entries_no_truncate
before truncate on public.ledger_entries
for each statement execute function public.prevent_mutation();

create function public.is_own_ledger_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ledger_entries
    where id = p_entry_id
      and created_by = (select auth.uid())
  );
$$;

alter table public.ledger_entries enable row level security;

create policy "ledger_entries: owner y admin ven todo"
on public.ledger_entries for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "ledger_entries: staff ve lo que registró"
on public.ledger_entries for select
to authenticated
using (
  public.has_role(array['staff']::public.app_role[])
  and created_by = (select auth.uid())
);

create policy "ledger_entries: owner y admin registran"
on public.ledger_entries for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- Staff: ingresos y gastos solo con categorías sales u operating_expense.
-- Puede revertir lo que registró (el reverso hereda la categoría del original).
create policy "ledger_entries: staff registra ventas y gastos operativos"
on public.ledger_entries for insert
to authenticated
with check (
  public.has_role(array['staff']::public.app_role[])
  and entry_type in ('income', 'expense')
  and transfer_id is null
  and person_id is null
  and public.staff_can_use_category(category_id)
  and (reverses_entry_id is null or public.is_own_ledger_entry(reverses_entry_id))
);

-- ============================================================
-- Saldos
-- ============================================================

create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.name,
  a.currency,
  a.kind,
  a.is_active,
  coalesce(sum(l.amount), 0)::numeric(20, 2) as balance,
  count(l.id) as entries_count,
  max(l.occurred_at) as last_movement_at
from public.accounts a
left join public.ledger_entries l on l.account_id = a.id
where public.has_role(array['owner', 'admin']::public.app_role[])
group by a.id;

-- ============================================================
-- Operaciones compuestas (una transacción cada una; RLS aplica)
-- ============================================================

-- Traspaso o conversión. La parte que llega sale como transfer_out y la
-- diferencia de valor queda como exchange_fee en la cuenta de origen:
-- los saldos cuadran y la comisión es un registro propio.
create function public.create_account_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount_out numeric,
  p_amount_in numeric,
  p_occurred_at timestamptz default now(),
  p_note text default null,
  p_receipt_path text default null,
  p_bcv_usd_rate numeric default null,
  p_binance_rate numeric default null,
  p_usd_usdt_rate numeric default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_transfer public.account_transfers;
  v_from_currency public.currency;
  v_to_currency public.currency;
  v_fee_category_id uuid;
  v_out_portion numeric;
  v_fee_amount numeric;
begin
  insert into public.account_transfers (
    from_account_id, to_account_id, amount_out, amount_in, occurred_at,
    note, receipt_path, bcv_usd_rate, binance_rate, usd_usdt_rate
  )
  values (
    p_from_account_id, p_to_account_id, p_amount_out, p_amount_in, p_occurred_at,
    p_note, p_receipt_path, p_bcv_usd_rate, p_binance_rate, p_usd_usdt_rate
  )
  returning * into v_transfer;

  select currency into v_from_currency from public.accounts where id = v_transfer.from_account_id;
  select currency into v_to_currency from public.accounts where id = v_transfer.to_account_id;

  if v_from_currency = v_to_currency then
    v_out_portion := v_transfer.amount_in;
  else
    v_out_portion := public.from_usdt(
      public.to_usdt(v_transfer.amount_in, v_to_currency, v_transfer.binance_rate, v_transfer.usd_usdt_rate),
      v_from_currency,
      v_transfer.binance_rate,
      v_transfer.usd_usdt_rate
    );
  end if;

  if v_out_portion <= 0 then
    raise exception 'El monto recibido es demasiado pequeño para registrarlo.';
  end if;

  v_fee_amount := v_transfer.amount_out - v_out_portion;

  perform set_config('app.creating_transfer', v_transfer.id::text, true);

  insert into public.ledger_entries (
    account_id, entry_type, amount, occurred_at, description, transfer_id,
    bcv_usd_rate, binance_rate, usd_usdt_rate, receipt_path
  )
  values (
    v_transfer.from_account_id, 'transfer_out', -v_out_portion, v_transfer.occurred_at,
    v_transfer.note, v_transfer.id,
    v_transfer.bcv_usd_rate, v_transfer.binance_rate, v_transfer.usd_usdt_rate, v_transfer.receipt_path
  );

  if v_fee_amount <> 0 then
    select id into v_fee_category_id
    from public.movement_categories
    where is_system and type = 'exchange_fee';

    insert into public.ledger_entries (
      account_id, entry_type, category_id, amount, occurred_at, description, transfer_id,
      bcv_usd_rate, binance_rate, usd_usdt_rate, receipt_path
    )
    values (
      v_transfer.from_account_id, 'exchange_fee', v_fee_category_id, -v_fee_amount,
      v_transfer.occurred_at, v_transfer.note, v_transfer.id,
      v_transfer.bcv_usd_rate, v_transfer.binance_rate, v_transfer.usd_usdt_rate, v_transfer.receipt_path
    );
  end if;

  insert into public.ledger_entries (
    account_id, entry_type, amount, occurred_at, description, transfer_id,
    bcv_usd_rate, binance_rate, usd_usdt_rate, receipt_path
  )
  values (
    v_transfer.to_account_id, 'transfer_in', v_transfer.amount_in, v_transfer.occurred_at,
    v_transfer.note, v_transfer.id,
    v_transfer.bcv_usd_rate, v_transfer.binance_rate, v_transfer.usd_usdt_rate, v_transfer.receipt_path
  );

  perform set_config('app.creating_transfer', '', true);

  return v_transfer.id;
end;
$$;

create function public.reverse_ledger_entry(p_entry_id uuid, p_reason text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.ledger_entries (reverses_entry_id, description)
  values (p_entry_id, p_reason)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.reverse_account_transfer(p_transfer_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.account_transfers where id = p_transfer_id) then
    raise exception 'El traspaso no existe.';
  end if;

  if exists (
    select 1
    from public.ledger_entries
    where transfer_id = p_transfer_id
      and reverses_entry_id is not null
  ) then
    raise exception 'Este traspaso ya fue anulado.';
  end if;

  perform set_config('app.reversing_transfer', p_transfer_id::text, true);

  insert into public.ledger_entries (reverses_entry_id, description)
  select id, p_reason
  from public.ledger_entries
  where transfer_id = p_transfer_id
    and reverses_entry_id is null;

  perform set_config('app.reversing_transfer', '', true);
end;
$$;

-- ============================================================
-- Permisos: anon no ve nada; authenticated solo lo necesario (RLS decide filas).
-- ============================================================

revoke all on table
  public.exchange_rates,
  public.accounts,
  public.movement_categories,
  public.payment_methods,
  public.account_transfers,
  public.ledger_entries,
  public.current_exchange_rate,
  public.account_balances
from anon, authenticated;

grant select, insert on public.exchange_rates to authenticated;
grant select on public.current_exchange_rate to authenticated;

grant select on public.accounts to authenticated;
grant insert (name, currency, kind, is_active, notes) on public.accounts to authenticated;
grant update (name, kind, is_active, notes) on public.accounts to authenticated;

grant select on public.movement_categories to authenticated;
grant insert (name, type, is_active) on public.movement_categories to authenticated;
grant update (name, is_active) on public.movement_categories to authenticated;

grant select on public.payment_methods to authenticated;
grant insert (name, account_id, price_currency, sort_order, is_active) on public.payment_methods to authenticated;
grant update (name, account_id, price_currency, sort_order, is_active) on public.payment_methods to authenticated;

grant select, insert on public.account_transfers to authenticated;
grant select, insert on public.ledger_entries to authenticated;
grant select on public.account_balances to authenticated;

-- Supabase da EXECUTE por defecto a anon y authenticated en cada función nueva.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.current_app_role(),
  public.has_role(public.app_role[]),
  public.caracas_today(),
  public.to_usdt(numeric, public.currency, numeric, numeric),
  public.from_usdt(numeric, public.currency, numeric, numeric),
  public.latest_exchange_rate(),
  public.require_latest_exchange_rate(),
  public.exchange_rate_exists_for(date),
  public.category_type_requires_person(public.category_type),
  public.category_type_staff_allowed(public.category_type),
  public.staff_can_use_category(uuid),
  public.is_own_ledger_entry(uuid),
  public.create_account_transfer(uuid, uuid, numeric, numeric, timestamptz, text, text, numeric, numeric, numeric),
  public.reverse_ledger_entry(uuid, text),
  public.reverse_account_transfer(uuid, text)
to authenticated;
