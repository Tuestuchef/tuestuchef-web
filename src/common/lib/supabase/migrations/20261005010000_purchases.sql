-- Fase 2 · Proveedores, materia prima, compras, cuentas por pagar y por cobrar.
-- Modelo en docs/modelo-de-datos.md (sección 6).
-- - Compras como las ventas: total y saldo en USD de referencia; cada pago guarda su moneda,
--   monto, tasas del momento, equivalente en USD y valor real (USDT). Inmutables; se anulan.
-- - Líneas de inventario (mueven stock, materia prima o producto terminado) y de concepto
--   (servicios, alquiler, maquila…, sin stock). Cada línea lleva su categoría.
-- - Cada pago se reparte en el libro por categoría, en proporción a las líneas.
-- - Pagos en Bs: tasa BCV o paralelo (Binance) de la fecha del pago, nunca escrita a mano.
--   El valor real (usdt_value) siempre usa Binance.
-- - Staff registra compras pagadas en el momento. Crédito, pagos posteriores, anulaciones y
--   saldos: owner y admin.

-- ============================================================
-- Proveedores
-- ============================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 120),
  rif text unique check (rif is null or rif ~ '^[VEJPG][0-9]{5,10}$'),
  contact_name text check (contact_name is null or length(contact_name) <= 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  notes text check (notes is null or length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger suppliers_created_audit before insert on public.suppliers
  for each row execute function public.set_created_audit();
create trigger suppliers_updated_audit before update on public.suppliers
  for each row execute function public.set_updated_audit();

-- ============================================================
-- Compras
-- ============================================================

create sequence public.purchase_number_seq;

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.purchase_number_seq'),
  supplier_id uuid not null references public.suppliers (id),
  total_usd numeric(20, 2) not null check (total_usd > 0),
  -- Solo compras a crédito (owner y admin).
  due_date date,
  bcv_usd_rate numeric(20, 8) not null check (bcv_usd_rate > 0),
  bcv_eur_rate numeric(20, 8) not null check (bcv_eur_rate > 0),
  binance_rate numeric(20, 8) not null check (binance_rate > 0),
  usd_usdt_rate numeric(20, 8) not null check (usd_usdt_rate > 0),
  notes text check (notes is null or length(notes) <= 500),
  receipt_path text check (receipt_path is null or receipt_path !~* '^[a-z]+://'),
  occurred_at timestamptz not null default now(),
  is_backdated boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index purchases_supplier_idx on public.purchases (supplier_id, occurred_at desc);
create index purchases_occurred_idx on public.purchases (occurred_at desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id),
  line_type public.purchase_line_type not null,
  variant_id uuid references public.product_variants (id),
  description text,
  category_id uuid not null references public.movement_categories (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost_usd numeric(20, 4) not null check (unit_cost_usd > 0),
  line_total_usd numeric(20, 2) not null check (line_total_usd > 0),
  -- Costo unitario en USDT que entra al stock (solo inventario).
  unit_cost_usdt numeric(20, 6),
  created_at timestamptz not null default now(),
  constraint purchase_items_shape check (
    (line_type = 'inventory' and variant_id is not null and unit_cost_usdt is not null)
    or (line_type = 'concept' and variant_id is null and length(trim(coalesce(description, ''))) > 0)
  )
);

create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

alter table public.stock_movements add column purchase_item_id uuid references public.purchase_items (id);

create table public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id),
  account_id uuid not null references public.accounts (id),
  currency public.currency not null,
  amount numeric(20, 2) not null check (amount > 0),
  rate_kind public.supplier_rate_kind not null,
  -- Bs por USD usados para convertir (null si no es en Bs).
  applied_rate numeric(20, 8),
  usd_amount numeric(20, 6) not null check (usd_amount > 0),
  -- Valor real de lo pagado (positivo), siempre con Binance.
  usdt_value numeric(20, 6) not null,
  bcv_usd_rate numeric(20, 8) not null,
  bcv_eur_rate numeric(20, 8) not null,
  binance_rate numeric(20, 8) not null,
  usd_usdt_rate numeric(20, 8) not null,
  receipt_path text check (receipt_path is null or receipt_path !~* '^[a-z]+://'),
  occurred_at timestamptz not null,
  is_backdated boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index purchase_payments_purchase_idx on public.purchase_payments (purchase_id);

-- Un pago se reparte en el libro por categoría: una entrada por categoría.
create table public.purchase_payment_entries (
  purchase_payment_id uuid not null references public.purchase_payments (id),
  purchase_id uuid not null references public.purchases (id),
  ledger_entry_id uuid not null unique references public.ledger_entries (id),
  category_id uuid not null references public.movement_categories (id),
  primary key (purchase_payment_id, ledger_entry_id)
);

create table public.purchase_voids (
  purchase_id uuid primary key references public.purchases (id),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['purchases', 'purchase_items', 'purchase_payments', 'purchase_payment_entries', 'purchase_voids']
  loop
    execute format('create trigger %1$s_immutable before update or delete on public.%1$s for each row execute function public.prevent_mutation()', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;

-- ============================================================
-- Libro: tipo purchase_payment (reemplaza la función; cambios marcados con «compras»)
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

-- Los pagos de compra solo se revierten al anular la compra.
create or replace function public.ledger_entries_guard_purchase_payment_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reverses_entry_id is not null
     and exists (select 1 from public.ledger_entries where id = new.reverses_entry_id and entry_type = 'purchase_payment')
     and coalesce(current_setting('app.voiding_purchase', true), '') = '' then
    raise exception 'Los pagos de una compra se revierten anulando la compra.';
  end if;
  return new;
end;
$$;

create trigger ledger_entries_guard_purchase_payment_reversal
before insert on public.ledger_entries
for each row execute function public.ledger_entries_guard_purchase_payment_reversal();

-- ============================================================
-- Stock: compras y su reverso solo desde el módulo de compras
-- (reemplaza la función; cambios marcados con «compras»)
-- ============================================================

create or replace function public.stock_movements_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.product_variants;
  v_product public.products;
  v_balance numeric;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();

  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'La fecha del movimiento no puede ser futura.';
  end if;

  -- Bloquea la variante: dos movimientos simultáneos no pueden dejar el stock negativo.
  select * into v_variant from public.product_variants where id = new.variant_id for update;
  if not found then
    raise exception 'La variante no existe.';
  end if;
  select * into v_product from public.products where id = v_variant.product_id;

  -- «compras» Los reversos no exigen que el producto siga activo.
  if new.movement_type not in ('sale', 'sale_reversal', 'purchase_reversal') then
    if not v_variant.is_active or not v_product.is_active then
      raise exception 'El producto o la variante están inactivos.';
    end if;
  end if;

  if v_product.fulfillment_type = 'made_to_order' then
    raise exception '"%" se hace solo por encargo: no lleva stock.', v_product.name;
  end if;

  if new.movement_type in ('sale', 'sale_reversal')
     and coalesce(current_setting('app.creating_sale', true), '') = '' then
    raise exception 'Las salidas por venta se registran desde el módulo de ventas.';
  end if;

  -- «compras»
  if new.movement_type in ('purchase', 'purchase_reversal')
     and coalesce(current_setting('app.creating_purchase', true), '') = '' then
    raise exception 'Las compras se registran desde el módulo de compras, con su proveedor.';
  end if;

  -- Signo según el tipo.
  if (new.movement_type in ('initial_count', 'purchase', 'production', 'sale_reversal') and new.quantity < 0)
     or (new.movement_type in ('sale', 'purchase_reversal') and new.quantity > 0) then
    raise exception 'Cantidad inválida para un movimiento de tipo %.', new.movement_type;
  end if;

  if new.movement_type in ('purchase', 'production') and new.unit_cost_usdt is null then
    raise exception 'Indica el costo unitario.';
  end if;

  if new.movement_type = 'adjustment' and coalesce(trim(new.note), '') = '' then
    raise exception 'Indica el motivo del ajuste.';
  end if;

  if new.movement_type = 'initial_count'
     and exists (select 1 from public.stock_movements where variant_id = new.variant_id) then
    raise exception 'La variante % ya tiene movimientos: usa un ajuste.', v_variant.sku;
  end if;

  select coalesce(sum(quantity), 0) into v_balance from public.stock_movements where variant_id = new.variant_id;
  if v_balance + new.quantity < 0 then
    raise exception 'Stock insuficiente de %: hay %, se piden %.', v_variant.sku, v_balance, -new.quantity;
  end if;

  return new;
end;
$$;

-- La materia prima no se vende.
create or replace function public.sale_items_block_raw_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
begin
  select p.* into v_product
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = new.variant_id;
  if v_product.kind = 'raw_material' then
    raise exception '"%" es materia prima: no se vende.', v_product.name;
  end if;
  return new;
end;
$$;

create trigger sale_items_block_raw_material
before insert on public.sale_items
for each row execute function public.sale_items_block_raw_material();

-- ============================================================
-- Funciones de compras
-- ============================================================

create or replace function public.purchase_label(p_number bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'C-' || lpad(p_number::text, 6, '0');
$$;

-- Registra un pago: una entrada en el libro por categoría (proporcional a las líneas)
-- y su aplicación a la compra. Interna: la llaman create_purchase y add_purchase_payment.
create or replace function public.apply_purchase_payment(
  p_purchase_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_rate_kind public.supplier_rate_kind default 'none',
  p_receipt_path text default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_account public.accounts;
  v_rate public.exchange_rates;
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_date date;
  v_rate_kind public.supplier_rate_kind;
  v_applied_rate numeric;
  v_usd numeric;
  v_paid numeric;
  v_supplier text;
  v_line record;
  v_count integer;
  v_index integer := 0;
  v_part numeric;
  v_assigned numeric := 0;
  v_entry public.ledger_entries;
  v_entries uuid[] := '{}';
  v_categories uuid[] := '{}';
  v_usdt numeric := 0;
  v_payment_id uuid;
  v_i integer;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'La compra no existe.';
  end if;
  if exists (select 1 from public.purchase_voids where purchase_id = p_purchase_id) then
    raise exception 'La compra % está anulada.', public.purchase_label(v_purchase.number);
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero.';
  end if;

  v_date := public.check_occurred_at(v_at);
  if v_date < (v_purchase.occurred_at at time zone 'America/Caracas')::date then
    raise exception 'El pago no puede ser anterior a la compra.';
  end if;

  select * into v_account from public.accounts where id = p_account_id;
  if not found or not v_account.is_active then
    raise exception 'La cuenta no existe o está inactiva.';
  end if;

  -- Bs: la tasa la elige quien paga (BCV o paralelo), siempre la registrada para esa fecha.
  if v_account.currency = 'VES' then
    if p_rate_kind is null or p_rate_kind = 'none' then
      raise exception 'Elige la tasa del pago en Bs: BCV o paralelo.';
    end if;
    v_rate_kind := p_rate_kind;
  else
    v_rate_kind := 'none';
  end if;

  if v_date < public.caracas_today() then
    v_rate := public.require_exchange_rate_for_date(v_date);
  elsif v_account.currency = 'VES' then
    v_rate := public.require_current_exchange_rate();
  else
    v_rate := public.require_latest_exchange_rate();
  end if;

  v_applied_rate := case v_rate_kind
    when 'bcv_usd' then v_rate.bcv_usd
    when 'parallel' then v_rate.binance_usdt * v_rate.usd_usdt
  end;
  v_usd := round(
    case
      when v_rate_kind <> 'none' then p_amount / v_applied_rate
      when v_account.currency = 'USDT' then p_amount / v_rate.usd_usdt
      else p_amount
    end,
    6
  );

  select coalesce(sum(usd_amount), 0) into v_paid from public.purchase_payments where purchase_id = p_purchase_id;
  if v_paid + v_usd > v_purchase.total_usd + 0.01 then
    raise exception 'El pago supera el saldo pendiente (US$ %).', round(v_purchase.total_usd - v_paid, 2);
  end if;

  select name into v_supplier from public.suppliers where id = v_purchase.supplier_id;
  select count(distinct category_id) into v_count from public.purchase_items where purchase_id = p_purchase_id;

  perform set_config('app.creating_purchase_payment', p_purchase_id::text, true);
  for v_line in
    select category_id, sum(line_total_usd) as usd
    from public.purchase_items
    where purchase_id = p_purchase_id
    group by category_id
    order by sum(line_total_usd) desc, category_id
  loop
    v_index := v_index + 1;
    v_part := case
      when v_index = v_count then p_amount - v_assigned
      -- Truncar (no redondear) garantiza que la última parte nunca quede negativa:
      -- las entradas suman exactamente el monto pagado.
      else trunc(p_amount * v_line.usd / v_purchase.total_usd, 2)
    end;
    v_assigned := v_assigned + v_part;
    continue when v_part <= 0;

    insert into public.ledger_entries (
      account_id, entry_type, category_id, amount, description, occurred_at,
      bcv_usd_rate, binance_rate, usd_usdt_rate, receipt_path
    )
    values (
      p_account_id, 'purchase_payment', v_line.category_id, -v_part,
      'Compra ' || public.purchase_label(v_purchase.number) || ' · ' || v_supplier, v_at,
      v_rate.bcv_usd, v_rate.binance_usdt, v_rate.usd_usdt, p_receipt_path
    )
    returning * into v_entry;
    v_entries := v_entries || v_entry.id;
    v_categories := v_categories || v_line.category_id;
    v_usdt := v_usdt - v_entry.usdt_value;
  end loop;
  perform set_config('app.creating_purchase_payment', '', true);

  insert into public.purchase_payments (
    purchase_id, account_id, currency, amount, rate_kind, applied_rate, usd_amount, usdt_value,
    bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, receipt_path, occurred_at, is_backdated
  )
  values (
    p_purchase_id, p_account_id, v_account.currency, p_amount, v_rate_kind, v_applied_rate, v_usd, v_usdt,
    v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt, p_receipt_path, v_at,
    v_date < public.caracas_today()
  )
  returning id into v_payment_id;

  for v_i in 1 .. coalesce(array_length(v_entries, 1), 0) loop
    insert into public.purchase_payment_entries (purchase_payment_id, purchase_id, ledger_entry_id, category_id)
    values (v_payment_id, p_purchase_id, v_entries[v_i], v_categories[v_i]);
  end loop;

  return v_payment_id;
end;
$$;

-- Crea la compra completa en una transacción: líneas, stock y pagos.
-- p_items:    [{ "line_type": "inventory", "variant_id": uuid, "quantity": n, "unit_cost_usd": n, "category_id": uuid }
--              | { "line_type": "concept", "description": text, "quantity": n, "unit_cost_usd": n, "category_id": uuid }]
-- p_payments: [{ "account_id": uuid, "amount": n, "rate_kind": "bcv_usd" | "parallel" | "none", "receipt_path": text? }]
create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_items jsonb,
  p_payments jsonb default '[]',
  p_due_date date default null,
  p_notes text default null,
  p_receipt_path text default null,
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
  v_rate public.exchange_rates;
  v_item jsonb;
  v_payment jsonb;
  v_type public.purchase_line_type;
  v_category public.movement_categories;
  v_variant public.product_variants;
  v_product public.products;
  v_quantity numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_lines jsonb := '[]';
  v_line jsonb;
  v_purchase_id uuid;
  v_item_id uuid;
  v_paid numeric;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar compras.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos una línea.';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and is_active) then
    raise exception 'El proveedor no existe o está inactivo.';
  end if;

  v_date := public.check_occurred_at(v_at);
  if v_date < public.caracas_today() then
    v_rate := public.require_exchange_rate_for_date(v_date);
  else
    v_rate := public.require_latest_exchange_rate();
  end if;

  if p_due_date is not null then
    if not v_is_management then
      raise exception 'Las compras a crédito son de owner y admin.';
    end if;
    if p_due_date < v_date then
      raise exception 'El vencimiento no puede ser anterior a la compra.';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_type := coalesce(v_item ->> 'line_type', 'inventory')::public.purchase_line_type;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_cost := (v_item ->> 'unit_cost_usd')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida.';
    end if;
    if v_cost is null or v_cost <= 0 then
      raise exception 'Costo unitario inválido.';
    end if;

    select * into v_category from public.movement_categories where id = (v_item ->> 'category_id')::uuid;
    if not found or not v_category.is_active then
      raise exception 'Elige una categoría válida para cada línea.';
    end if;
    if v_category.type not in ('cost', 'operating_expense', 'reinvestment', 'tax') then
      raise exception 'La categoría "%" no se usa en compras.', v_category.name;
    end if;
    if not v_is_management and not public.staff_can_use_category(v_category.id) then
      raise exception 'Staff no puede usar la categoría "%".', v_category.name;
    end if;

    if v_type = 'inventory' then
      select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
      if not found then
        raise exception 'Uno de los productos ya no existe.';
      end if;
      select * into v_product from public.products where id = v_variant.product_id;
      if not v_product.is_active or not v_variant.is_active then
        raise exception '"%" (%) está inactivo.', v_product.name, v_variant.sku;
      end if;
      if v_product.fulfillment_type = 'made_to_order' then
        raise exception '"%" se hace solo por encargo: no lleva stock.', v_product.name;
      end if;
    elsif coalesce(trim(v_item ->> 'description'), '') = '' then
      raise exception 'Describe cada línea de concepto (p. ej. "Alquiler de octubre").';
    end if;

    v_total := v_total + round(v_cost * v_quantity, 2);
    v_lines := v_lines || jsonb_build_object(
      'line_type', v_type,
      'variant_id', case when v_type = 'inventory' then v_variant.id end,
      'description', nullif(trim(v_item ->> 'description'), ''),
      'category_id', v_category.id,
      'quantity', v_quantity,
      'cost', v_cost
    );
  end loop;

  insert into public.purchases (
    supplier_id, total_usd, due_date, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate,
    notes, receipt_path, occurred_at, is_backdated
  )
  values (
    p_supplier_id, v_total, p_due_date, v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt,
    nullif(trim(p_notes), ''), p_receipt_path, v_at, v_date < public.caracas_today()
  )
  returning id into v_purchase_id;

  perform set_config('app.creating_purchase', v_purchase_id::text, true);
  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.purchase_items (
      purchase_id, line_type, variant_id, description, category_id, quantity, unit_cost_usd, line_total_usd, unit_cost_usdt
    )
    values (
      v_purchase_id,
      (v_line ->> 'line_type')::public.purchase_line_type,
      (v_line ->> 'variant_id')::uuid,
      v_line ->> 'description',
      (v_line ->> 'category_id')::uuid,
      (v_line ->> 'quantity')::numeric,
      (v_line ->> 'cost')::numeric,
      round((v_line ->> 'cost')::numeric * (v_line ->> 'quantity')::numeric, 2),
      -- Costo en USDT con la tasa USD→USDT de la fecha de la compra.
      case when v_line ->> 'line_type' = 'inventory'
        then round((v_line ->> 'cost')::numeric * v_rate.usd_usdt, 6) end
    )
    returning id into v_item_id;

    if v_line ->> 'line_type' = 'inventory' then
      insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, purchase_item_id, occurred_at)
      values (
        (v_line ->> 'variant_id')::uuid, 'purchase', (v_line ->> 'quantity')::numeric,
        round((v_line ->> 'cost')::numeric * v_rate.usd_usdt, 6), v_item_id, v_at
      );
    end if;
  end loop;
  perform set_config('app.creating_purchase', '', true);

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    perform public.apply_purchase_payment(
      v_purchase_id,
      (v_payment ->> 'account_id')::uuid,
      (v_payment ->> 'amount')::numeric,
      coalesce(nullif(v_payment ->> 'rate_kind', ''), 'none')::public.supplier_rate_kind,
      nullif(v_payment ->> 'receipt_path', ''),
      v_at
    );
  end loop;

  -- Staff: solo compras pagadas completas en el momento.
  if not v_is_management then
    select coalesce(sum(usd_amount), 0) into v_paid from public.purchase_payments where purchase_id = v_purchase_id;
    if v_total - v_paid > 0.01 then
      raise exception 'Staff solo registra compras pagadas completas en el momento. Las compras a crédito son de owner y admin.';
    end if;
  end if;

  return v_purchase_id;
end;
$$;

-- Pagos posteriores (abonos a proveedores): owner y admin.
create or replace function public.add_purchase_payment(
  p_purchase_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_rate_kind public.supplier_rate_kind default 'none',
  p_receipt_path text default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin pagan cuentas por pagar.' using errcode = '42501';
  end if;
  return public.apply_purchase_payment(p_purchase_id, p_account_id, p_amount, p_rate_kind, p_receipt_path, p_occurred_at);
end;
$$;

-- Anular: owner y admin, con motivo. Revierte los pagos en el libro y saca del stock lo que entró.
create or replace function public.void_purchase(p_purchase_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_label text;
  v_entry record;
  v_move record;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin pueden anular compras.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la anulación.';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'La compra no existe.';
  end if;
  v_label := public.purchase_label(v_purchase.number);
  if exists (select 1 from public.purchase_voids where purchase_id = p_purchase_id) then
    raise exception 'La compra % ya está anulada.', v_label;
  end if;

  insert into public.purchase_voids (purchase_id, reason) values (p_purchase_id, trim(p_reason));

  perform set_config('app.voiding_purchase', p_purchase_id::text, true);
  for v_entry in select ledger_entry_id from public.purchase_payment_entries where purchase_id = p_purchase_id loop
    insert into public.ledger_entries (reverses_entry_id, description)
    values (v_entry.ledger_entry_id, 'Anulación de ' || v_label || ': ' || trim(p_reason));
  end loop;
  perform set_config('app.voiding_purchase', '', true);

  perform set_config('app.creating_purchase', p_purchase_id::text, true);
  for v_move in
    select m.variant_id, m.quantity, m.unit_cost_usdt, m.purchase_item_id
    from public.stock_movements m
    join public.purchase_items i on i.id = m.purchase_item_id
    where i.purchase_id = p_purchase_id and m.movement_type = 'purchase'
  loop
    begin
      insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, purchase_item_id, note)
      values (v_move.variant_id, 'purchase_reversal', -v_move.quantity, v_move.unit_cost_usdt, v_move.purchase_item_id,
              'Anulación de ' || v_label);
    exception when others then
      raise exception 'No se puede anular %: parte de esa mercancía ya se vendió o se usó (%). Corrige con un ajuste.',
        v_label, sqlerrm;
    end;
  end loop;
  perform set_config('app.creating_purchase', '', true);
end;
$$;

-- ============================================================
-- Vistas
-- ============================================================

create view public.purchases_summary
with (security_invoker = true)
as
select
  p.id as purchase_id,
  p.number,
  p.supplier_id,
  p.occurred_at,
  p.due_date,
  p.total_usd,
  coalesce(pp.paid_usd, 0)::numeric(20, 6) as paid_usd,
  greatest(p.total_usd - coalesce(pp.paid_usd, 0), 0)::numeric(20, 6) as balance_usd,
  coalesce(pp.usdt_value, 0)::numeric(20, 6) as paid_usdt,
  (v.purchase_id is not null) as is_voided,
  case
    when v.purchase_id is not null then 'voided'
    when p.total_usd - coalesce(pp.paid_usd, 0) <= 0.01 then 'paid'
    when coalesce(pp.paid_usd, 0) > 0 then 'partial'
    else 'pending'
  end as payment_status
from public.purchases p
left join (
  select purchase_id, sum(usd_amount) as paid_usd, sum(usdt_value) as usdt_value
  from public.purchase_payments
  group by purchase_id
) pp on pp.purchase_id = p.id
left join public.purchase_voids v on v.purchase_id = p.id;

-- Cuentas por pagar: owner y admin (staff recibe 0 filas).
create view public.payables
with (security_invoker = true)
as
select
  s.purchase_id,
  s.number,
  s.supplier_id,
  sup.name as supplier_name,
  s.occurred_at,
  s.due_date,
  s.total_usd,
  s.balance_usd,
  case when s.due_date is not null and s.due_date < public.caracas_today()
    then public.caracas_today() - s.due_date end as days_overdue
from public.purchases_summary s
join public.suppliers sup on sup.id = s.supplier_id
where not s.is_voided
  and s.balance_usd > 0.01
  and public.has_role(array['owner', 'admin']::public.app_role[]);

-- Cuentas por cobrar: se calcula desde las ventas (sin duplicar datos). Owner y admin.
create view public.receivables
with (security_invoker = true)
as
select
  s.sale_id,
  s.number,
  s.customer_id,
  nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as customer_name,
  c.phone as customer_phone,
  s.occurred_at,
  s.total_usd,
  s.balance_usd,
  public.caracas_today() - (s.occurred_at at time zone 'America/Caracas')::date as days_outstanding
from public.sales_summary s
left join public.customers c on c.id = s.customer_id
where not s.is_voided
  and s.balance_usd > 0.01
  and public.has_role(array['owner', 'admin']::public.app_role[]);

-- ============================================================
-- RLS y permisos
-- ============================================================

-- ¿La compra la registró quien consulta? (staff ve solo lo suyo)
create or replace function public.is_own_purchase(p_purchase_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.purchases where id = p_purchase_id and created_by = (select auth.uid())
  );
$$;

alter table public.suppliers enable row level security;

create policy "suppliers: todo el equipo los ve"
on public.suppliers for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "suppliers: todo el equipo los crea"
on public.suppliers for insert
to authenticated
with check (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "suppliers: owner y admin editan"
on public.suppliers for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

alter table public.purchases enable row level security;

create policy "purchases: owner y admin ven todo"
on public.purchases for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "purchases: staff ve lo que registró"
on public.purchases for select
to authenticated
using (public.has_role(array['staff']::public.app_role[]) and created_by = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['purchase_items', 'purchase_payments', 'purchase_payment_entries', 'purchase_voids']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: owner y admin ven todo" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: staff ve lo de sus compras" on public.%1$s for select to authenticated using (public.has_role(array[''staff'']::public.app_role[]) and public.is_own_purchase(purchase_id))', t);
  end loop;
end;
$$;

revoke all on table
  public.suppliers, public.purchases, public.purchase_items, public.purchase_payments,
  public.purchase_payment_entries, public.purchase_voids,
  public.purchases_summary, public.payables, public.receivables
from anon, authenticated;
revoke all on sequence public.purchase_number_seq from anon, authenticated;

grant select on public.suppliers to authenticated;
grant insert (name, rif, contact_name, phone, email, notes, is_active),
      update (name, rif, contact_name, phone, email, notes, is_active)
  on public.suppliers to authenticated;

grant select on
  public.purchases, public.purchase_items, public.purchase_payments, public.purchase_payment_entries,
  public.purchase_voids, public.purchases_summary, public.payables, public.receivables
to authenticated;

revoke execute on function
  public.ledger_entries_guard_purchase_payment_reversal(),
  public.sale_items_block_raw_material(),
  public.apply_purchase_payment(uuid, uuid, numeric, public.supplier_rate_kind, text, timestamptz)
from public, anon, authenticated;

revoke execute on function
  public.purchase_label(bigint),
  public.is_own_purchase(uuid),
  public.create_purchase(uuid, jsonb, jsonb, date, text, text, timestamptz),
  public.add_purchase_payment(uuid, uuid, numeric, public.supplier_rate_kind, text, timestamptz),
  public.void_purchase(uuid, text)
from public, anon;

grant execute on function
  public.purchase_label(bigint),
  public.is_own_purchase(uuid),
  public.create_purchase(uuid, jsonb, jsonb, date, text, text, timestamptz),
  public.add_purchase_payment(uuid, uuid, numeric, public.supplier_rate_kind, text, timestamptz),
  public.void_purchase(uuid, text)
to authenticated;
