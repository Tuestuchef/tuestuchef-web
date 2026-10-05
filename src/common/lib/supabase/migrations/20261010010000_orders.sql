-- Fase 3, paso 2: pedidos y producción.
--
-- Un pedido ES una venta (regla 6: un solo modelo de ventas). `orders` la extiende 1 a 1 con lo
-- que solo tiene un pedido: fecha prometida, modo de stock y abono requerido. Las líneas pasan por
-- etapas (por producir → corte → confección → personalización → revisión → empaque → listo →
-- entregado); las que no aplican se saltan solas. Cada etapa se asigna a una persona del equipo o a
-- un taller. Al completar el corte se consume la materia prima. Se entrega el pedido completo.
--
-- Abono: total ≥ umbral (500 USD) → % inicial (60%); por debajo, pago completo para producir.
-- Cancelar: antes del corte, cualquiera, con reembolso completo; después, solo owner o admin, con
-- un descuento (materiales consumidos + talleres) que confirman. Cada pago se reembolsa en su
-- moneda y cuenta. El cliente queda bloqueado.

-- ============================================================
-- Configuración de pedidos
-- ============================================================

create table public.order_settings (
  id boolean primary key default true check (id),
  -- Desde este total (USD de referencia) se cobra abono; por debajo, pago completo.
  deposit_threshold_usd numeric(20, 2) not null default 500 check (deposit_threshold_usd >= 0),
  deposit_percent numeric(5, 2) not null default 60 check (deposit_percent > 0 and deposit_percent <= 100),
  default_lead_days integer not null default 5 check (default_lead_days between 0 and 365),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
insert into public.order_settings default values;

create trigger order_settings_updated_audit before update on public.order_settings
  for each row execute function public.set_updated_audit();

-- ============================================================
-- Pedidos
-- ============================================================

create table public.orders (
  sale_id uuid primary key references public.sales (id),
  promised_date date not null,
  stock_mode public.order_stock_mode not null,
  -- Lo que hay que pagar para empezar a producir, fijado al crear el pedido.
  deposit_required_usd numeric(20, 2) not null check (deposit_required_usd >= 0),
  delivered_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
create index orders_promised_idx on public.orders (promised_date) where delivered_at is null;

-- Solo cambian la fecha prometida y la entrega (desde sus funciones).
create or replace function public.orders_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sale_id is distinct from old.sale_id
     or new.stock_mode is distinct from old.stock_mode
     or new.deposit_required_usd is distinct from old.deposit_required_usd
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Solo se cambian la fecha prometida y la entrega del pedido.';
  end if;
  if new.delivered_at is distinct from old.delivered_at
     and coalesce(current_setting('app.delivering_order', true), '') <> old.sale_id::text then
    raise exception 'El pedido se entrega con deliver_order.';
  end if;
  return new;
end;
$$;

create trigger orders_guard_update before update on public.orders
  for each row execute function public.orders_guard_update();
create trigger orders_updated_audit before update on public.orders
  for each row execute function public.set_updated_audit();
create trigger orders_no_delete before delete on public.orders
  for each row execute function public.prevent_mutation();

-- Excepciones con motivo: producir sin abono completo, o entregar con saldo.
create table public.order_overrides (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.orders (sale_id),
  kind public.order_override_kind not null,
  reason text not null check (length(trim(reason)) between 3 and 300),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint order_overrides_unique unique (sale_id, kind)
);

create table public.order_cancellations (
  sale_id uuid primary key references public.orders (sale_id),
  reason text not null check (length(trim(reason)) between 3 and 300),
  -- Si ya se había cortado: lo que no se devuelve (materiales y talleres), en USDT.
  production_started boolean not null,
  deduction_usdt numeric(20, 6) not null default 0 check (deduction_usdt >= 0),
  refunded_usdt numeric(20, 6) not null default 0 check (refunded_usdt >= 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.order_date_changes (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.orders (sale_id),
  previous_date date not null,
  new_date date not null,
  reason text check (reason is null or length(reason) <= 300),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Servicio de taller (bordado, confección) comprado para un pedido.
create table public.purchase_order_links (
  purchase_id uuid not null references public.purchases (id),
  sale_id uuid not null references public.orders (sale_id),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (purchase_id, sale_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['order_overrides', 'order_cancellations', 'order_date_changes', 'purchase_order_links']
  loop
    execute format('create trigger %1$s_immutable before update or delete on public.%1$s for each row execute function public.prevent_mutation()', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;

-- ============================================================
-- Líneas: piezas apartadas del inventario
-- ============================================================

-- En una línea por encargo, cuántas piezas salen del stock (apartadas al crear el pedido).
-- El resto se produce. Una línea de inventario normal sigue con source = 'stock'.
alter table public.sale_items
  add column reserved_quantity numeric(12, 3) not null default 0 check (reserved_quantity >= 0);
alter table public.sale_items add constraint sale_items_reserved_valid check (
  reserved_quantity <= quantity and (reserved_quantity = 0 or source = 'made_to_order')
);

-- ============================================================
-- Personalización de líneas
-- ============================================================

create table public.sale_item_customizations (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id),
  customization_type_id uuid not null references public.customization_types (id),
  -- Piezas de la línea con esta personalización.
  quantity numeric(12, 3) not null check (quantity > 0),
  text text check (text is null or length(trim(text)) between 1 and 60),
  logo_path text check (logo_path is null or logo_path !~* '^[a-z]+://'),
  position text check (position is null or length(position) <= 60),
  size_cm numeric(5, 1) check (size_cm is null or size_cm > 0),
  note text check (note is null or length(note) <= 300),
  unit_price_usd numeric(20, 2) not null check (unit_price_usd > 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  line_total_usd numeric(20, 2) not null check (line_total_usd >= 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index sale_item_customizations_item_idx on public.sale_item_customizations (sale_item_id);

-- Nombres a bordar, uno por pieza.
create table public.sale_item_customization_names (
  id uuid primary key default gen_random_uuid(),
  customization_id uuid not null references public.sale_item_customizations (id),
  ordinal integer not null check (ordinal >= 1),
  name text not null check (length(trim(name)) between 1 and 40),
  constraint sale_item_customization_names_unique unique (customization_id, ordinal)
);

do $$
declare
  t text;
begin
  foreach t in array array['sale_item_customizations', 'sale_item_customization_names']
  loop
    execute format('create trigger %1$s_immutable before update or delete on public.%1$s for each row execute function public.prevent_mutation()', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;

-- ============================================================
-- Talleres, asignaciones y destajo
-- ============================================================

alter table public.suppliers add column kind public.supplier_kind not null default 'goods';
alter table public.team_members add column pay_basis public.pay_basis not null default 'salary';

-- Quién tiene cada etapa de cada línea: una persona del equipo o un taller.
create table public.production_assignments (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id),
  stage public.sale_item_status not null
    check (stage in ('cutting', 'sewing', 'customization', 'quality_check', 'packing')),
  team_member_id uuid references public.team_members (id),
  supplier_id uuid references public.suppliers (id),
  -- Para talleres: fecha estimada de entrega, confirmada con ellos.
  expected_date date,
  note text check (note is null or length(note) <= 300),
  completed_at timestamptz,
  pieces numeric(12, 3) check (pieces is null or pieces > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint production_assignments_one_assignee check (num_nonnulls(team_member_id, supplier_id) = 1),
  constraint production_assignments_unique unique (sale_item_id, stage)
);
create index production_assignments_open_idx on public.production_assignments (team_member_id, supplier_id) where completed_at is null;

create trigger production_assignments_updated_audit before update on public.production_assignments
  for each row execute function public.set_updated_audit();
create trigger production_assignments_no_delete before delete on public.production_assignments
  for each row execute function public.prevent_mutation();

-- Tarifa por pieza según categoría de producto y etapa. Versionada: un cambio es una fila nueva.
create table public.piece_rates (
  id uuid primary key default gen_random_uuid(),
  product_category_id uuid not null references public.product_categories (id),
  stage public.sale_item_status not null
    check (stage in ('cutting', 'sewing', 'customization', 'quality_check', 'packing')),
  rate_usd numeric(20, 2) not null check (rate_usd >= 0),
  effective_from date not null default public.caracas_today(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint piece_rates_unique unique (product_category_id, stage, effective_from)
);

-- Piezas trabajadas a destajo: se generan al completar una etapa asignada.
create table public.piecework_entries (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members (id),
  assignment_id uuid not null unique references public.production_assignments (id),
  sale_item_id uuid not null references public.sale_items (id),
  stage public.sale_item_status not null,
  pieces numeric(12, 3) not null check (pieces > 0),
  rate_usd numeric(20, 2) not null check (rate_usd >= 0),
  amount_usd numeric(20, 2) not null check (amount_usd >= 0),
  completed_at timestamptz not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Qué pago de nómina liquidó cada pieza.
create table public.piecework_settlements (
  piecework_entry_id uuid primary key references public.piecework_entries (id),
  payroll_entry_id uuid not null references public.payroll_entries (id),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['piece_rates', 'piecework_entries', 'piecework_settlements']
  loop
    execute format('create trigger %1$s_immutable before update or delete on public.%1$s for each row execute function public.prevent_mutation()', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;

-- ============================================================
-- Clientes bloqueados
-- ============================================================

alter table public.customers
  add column blocked_at timestamptz,
  add column blocked_reason text check (blocked_reason is null or length(blocked_reason) <= 300);

create table public.customer_block_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  action public.customer_block_action not null,
  reason text not null check (length(trim(reason)) between 3 and 300),
  -- Pedido cancelado que originó el bloqueo, si lo hay.
  sale_id uuid references public.sales (id),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create trigger customer_block_events_immutable before update or delete on public.customer_block_events
  for each row execute function public.prevent_mutation();

-- El bloqueo solo cambia desde sus funciones.
create or replace function public.customers_guard_block()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.blocked_at is distinct from old.blocked_at or new.blocked_reason is distinct from old.blocked_reason)
     and coalesce(current_setting('app.changing_block', true), '') <> old.id::text then
    raise exception 'El bloqueo de un cliente cambia solo con bloquear o desbloquear, con motivo.';
  end if;
  return new;
end;
$$;

create trigger customers_guard_block before update on public.customers
  for each row execute function public.customers_guard_block();

create or replace function public.set_customer_block(
  p_customer_id uuid,
  p_action public.customer_block_action,
  p_reason text,
  p_sale_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'El cliente no existe.';
  end if;
  if (p_action = 'block') = (v_customer.blocked_at is not null) then
    return;
  end if;
  insert into public.customer_block_events (customer_id, action, reason, sale_id)
  values (p_customer_id, p_action, trim(p_reason), p_sale_id);
  perform set_config('app.changing_block', p_customer_id::text, true);
  update public.customers
  set blocked_at = case when p_action = 'block' then now() end,
      blocked_reason = case when p_action = 'block' then trim(p_reason) end
  where id = p_customer_id;
  perform set_config('app.changing_block', '', true);
end;
$$;

-- Bloquear o desbloquear a mano: solo owner y admin, con motivo.
create or replace function public.block_customer(p_customer_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin bloquean clientes.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo.';
  end if;
  perform public.set_customer_block(p_customer_id, 'block', p_reason);
end;
$$;

create or replace function public.unblock_customer(p_customer_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin desbloquean clientes.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo.';
  end if;
  perform public.set_customer_block(p_customer_id, 'unblock', p_reason);
end;
$$;

-- Misma cédula que un cliente bloqueado: el nuevo también queda bloqueado.
create or replace function public.customer_private_check_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocked uuid;
begin
  select c.id into v_blocked
  from public.customer_private cp join public.customers c on c.id = cp.customer_id
  where cp.id_document = new.id_document and cp.customer_id <> new.customer_id and c.blocked_at is not null
  limit 1;
  if v_blocked is not null then
    perform public.set_customer_block(new.customer_id, 'block', 'Misma cédula que un cliente bloqueado.');
  end if;
  return new;
end;
$$;

create trigger customer_private_check_block after insert or update on public.customer_private
  for each row execute function public.customer_private_check_block();

-- Para avisar antes de crear o vender: ¿estos datos coinciden con un cliente bloqueado?
-- La cédula se compara aquí dentro: nunca viaja a la pantalla.
create or replace function public.blocked_customer_match(
  p_phone text default null,
  p_email text default null,
  p_id_document text default null
)
returns table (customer_id uuid, customer_name text, blocked_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, trim(c.first_name || ' ' || coalesce(c.last_name, '')), c.blocked_reason
  from public.customers c
  left join public.customer_private cp on cp.customer_id = c.id
  where c.blocked_at is not null
    and public.has_role(array['owner', 'admin', 'staff']::public.app_role[])
    and ((p_phone is not null and c.phone = p_phone)
      or (p_email is not null and c.email = lower(p_email))
      or (p_id_document is not null and cp.id_document = upper(p_id_document)))
  limit 1;
$$;

-- ============================================================
-- Reglas de negocio
-- ============================================================

create table public.business_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 120),
  body text not null check (length(trim(body)) between 3 and 2000),
  -- El sistema la hace cumplir solo (si no, es una guía para el equipo).
  enforced_by_system boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.business_rule_revisions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.business_rules (id),
  title text not null,
  body text not null,
  enforced_by_system boolean not null,
  is_active boolean not null,
  changed_by uuid default auth.uid() references public.profiles (id),
  changed_at timestamptz not null default now()
);

create trigger business_rules_created_audit before insert on public.business_rules
  for each row execute function public.set_created_audit();
create trigger business_rules_updated_audit before update on public.business_rules
  for each row execute function public.set_updated_audit();
create trigger business_rule_revisions_immutable before update or delete on public.business_rule_revisions
  for each row execute function public.prevent_mutation();

-- Cada versión (también la primera) queda en el historial.
create or replace function public.business_rules_log_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_rule_revisions (rule_id, title, body, enforced_by_system, is_active)
  values (new.id, new.title, new.body, new.enforced_by_system, new.is_active);
  return new;
end;
$$;

create trigger business_rules_log_revision after insert or update on public.business_rules
  for each row execute function public.business_rules_log_revision();

insert into public.business_rules (title, body, enforced_by_system, sort_order) values (
  'Cliente que cancela con reembolso queda bloqueado',
  'Un cliente que cancela un pedido y recibe reembolso queda bloqueado y no se le vende más, ni en el panel ni en la tienda. El bloqueo también se detecta por teléfono, correo o cédula. Solo owner o admin pueden desbloquear, con motivo.',
  true,
  1
);

-- ============================================================
-- Libro: reembolsos de venta
-- ============================================================

-- Igual que antes, más 'sale_refund': solo desde cancel_order, categoría de ventas, en negativo.
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
    if v_original.entry_type = 'sale_refund' then
      raise exception 'Un reembolso no se revierte.';
    end if;
    if coalesce(trim(new.description), '') = '' then
      raise exception 'Indica el motivo del reverso.';
    end if;

    new.account_id := v_original.account_id;
    new.entry_type := v_original.entry_type;
    new.category_id := v_original.category_id;
    new.person_id := v_original.person_id;
    new.team_member_id := v_original.team_member_id;
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
  -- Un reembolso vuelve a la cuenta del pago, aunque ya esté inactiva.
  if not v_account.is_active and new.entry_type <> 'sale_refund' then
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

  -- Reembolsos: solo al cancelar un pedido.
  if new.entry_type = 'sale_refund'
     and coalesce(current_setting('app.refunding_sale', true), '') = '' then
    raise exception 'Los reembolsos se registran al cancelar un pedido.';
  end if;

  -- Pagos a proveedores: solo desde el módulo de compras.
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
    if not v_category.is_active and new.entry_type <> 'sale_refund' then
      raise exception 'La categoría "%" está inactiva.', v_category.name;
    end if;
    if not (
      (new.entry_type = 'income'
        and v_category.type in ('sales', 'other_income', 'capital_contribution'))
      or (new.entry_type = 'expense'
        and v_category.type in ('cost', 'operating_expense', 'exchange_fee', 'tax',
                                'salary', 'withdrawal', 'reinvestment', 'profit_distribution'))
      or (new.entry_type in ('sale_payment', 'sale_refund') and v_category.type = 'sales')
      or (new.entry_type = 'purchase_payment'
        and v_category.type in ('cost', 'operating_expense', 'reinvestment', 'tax'))
      or (new.entry_type = 'exchange_fee' and v_category.type = 'exchange_fee')
    ) then
      raise exception 'La categoría "%" no corresponde a un movimiento de tipo %.',
        v_category.name, new.entry_type;
    end if;
  end if;

  -- Persona del equipo y usuario se vinculan solos cuando la persona tiene cuenta.
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
     or (new.entry_type in ('expense', 'transfer_out', 'purchase_payment', 'sale_refund') and new.amount > 0) then
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

-- ============================================================
-- Ventas: núcleo compartido por create_sale y create_order
-- ============================================================

-- Inserta la venta. Interna: create_sale y create_order la usan.
--   · p_extra_subtotal_usd: personalización del pedido (se suma al subtotal).
--   · p_is_order: las líneas de un pedido empiezan en "por producir" y pasan por las etapas.
--   · Ítems: {variant_id, quantity, source, reserved_quantity?, components?}.
--   · Deja en app.last_sale_item_ids los id de las líneas principales, en el orden recibido.
create or replace function public.create_sale_core(
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
  p_is_order boolean
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
  v_customer public.customers;
  v_sale_id uuid;
  v_item jsonb;
  v_component jsonb;
  v_payment jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_source public.sale_line_source;
  v_quantity numeric;
  v_reserved numeric;
  v_price numeric;
  v_products_subtotal numeric := 0;
  v_subtotal numeric;
  v_pieces numeric := 0;
  v_volume_percent numeric := 0;
  v_volume numeric := 0;
  v_discount_base numeric;
  v_discount numeric := 0;
  v_max_percent numeric;
  v_item_id uuid;
  v_parent_id uuid;
  v_lines jsonb := '[]';
  v_line jsonb;
  v_children jsonb;
  v_child jsonb;
  v_def record;
  v_given numeric;
  v_top_ids jsonb := '[]';
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar ventas.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

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

  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id;
    if not found or not v_customer.is_active then
      raise exception 'El cliente no existe o está inactivo.';
    end if;
    -- Regla de negocio: a un cliente bloqueado no se le vende.
    if v_customer.blocked_at is not null then
      raise exception 'Cliente bloqueado: no se le puede vender. Motivo: %', coalesce(v_customer.blocked_reason, '—');
    end if;
  end if;

  if coalesce(p_delivery_fee_usd, 0) < 0 then
    raise exception 'El delivery no puede ser negativo.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida.';
    end if;

    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;
    select * into v_product from public.products where id = v_variant.product_id;
    if not v_product.is_active or not v_variant.is_active then
      raise exception '"%" (%) está inactivo.', v_product.name, v_variant.sku;
    end if;

    select amount_usd into v_price
    from public.product_prices
    where product_id = v_product.id and payment_method_id = p_price_method_id;
    if v_price is null then
      raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_method.name;
    end if;

    if v_product.kind = 'combo' then
      if v_quantity <> trunc(v_quantity) then
        raise exception 'Los combos se venden por unidades enteras.';
      end if;
      if jsonb_typeof(v_item -> 'components') is distinct from 'array' then
        raise exception 'Elige la talla y el color de cada componente de "%".', v_product.name;
      end if;
      if not exists (select 1 from public.combo_components where combo_product_id = v_product.id) then
        raise exception 'El combo "%" no tiene componentes definidos.', v_product.name;
      end if;

      v_children := '[]';
      for v_component in select * from jsonb_array_elements(v_item -> 'components') loop
        declare
          v_c_variant public.product_variants;
          v_c_product public.products;
          v_c_quantity numeric := (v_component ->> 'quantity')::numeric;
          v_c_source public.sale_line_source := coalesce(v_component ->> 'source', 'stock')::public.sale_line_source;
          v_c_reserved numeric := coalesce((v_component ->> 'reserved_quantity')::numeric, 0);
        begin
          if v_c_quantity is null or v_c_quantity <= 0 then
            raise exception 'Cantidad inválida en un componente de "%".', v_product.name;
          end if;
          select * into v_c_variant from public.product_variants where id = (v_component ->> 'variant_id')::uuid;
          if not found then
            raise exception 'Un componente de "%" ya no existe.', v_product.name;
          end if;
          select * into v_c_product from public.products where id = v_c_variant.product_id;
          if not exists (
            select 1 from public.combo_components
            where combo_product_id = v_product.id and component_product_id = v_c_product.id
          ) then
            raise exception '"%" no es parte del combo "%".', v_c_product.name, v_product.name;
          end if;
          if not v_c_product.is_active or not v_c_variant.is_active then
            raise exception '"%" (%) está inactivo.', v_c_product.name, v_c_variant.sku;
          end if;
          if v_c_source not in ('stock', 'made_to_order') then
            raise exception 'Origen inválido en un componente de "%".', v_product.name;
          end if;
          if v_c_product.fulfillment_type = 'stock' and v_c_source <> 'stock' then
            raise exception '"%" se vende solo de inventario.', v_c_product.name;
          end if;
          if v_c_product.fulfillment_type = 'made_to_order' and v_c_source <> 'made_to_order' then
            raise exception '"%" se vende solo por encargo.', v_c_product.name;
          end if;
          if v_c_reserved < 0 or v_c_reserved > v_c_quantity or (v_c_reserved > 0 and v_c_source <> 'made_to_order') then
            raise exception 'Piezas apartadas inválidas en "%".', v_c_product.name;
          end if;
          v_children := v_children || jsonb_build_object(
            'variant_id', v_c_variant.id, 'product_id', v_c_product.id, 'quantity', v_c_quantity,
            'source', v_c_source, 'reserved_quantity', v_c_reserved, 'cost', v_c_variant.unit_cost_usdt
          );
          v_pieces := v_pieces + v_c_quantity;
        end;
      end loop;

      for v_def in
        select cc.component_product_id, cc.quantity, p.name
        from public.combo_components cc join public.products p on p.id = cc.component_product_id
        where cc.combo_product_id = v_product.id
      loop
        select coalesce(sum((c ->> 'quantity')::numeric), 0) into v_given
        from jsonb_array_elements(v_children) c
        where (c ->> 'product_id')::uuid = v_def.component_product_id;
        if v_given <> v_def.quantity * v_quantity then
          raise exception 'El combo "%" lleva % de "%": elegiste %.',
            v_product.name, trim_scale(v_def.quantity * v_quantity), v_def.name, trim_scale(v_given);
        end if;
      end loop;

      v_products_subtotal := v_products_subtotal + round(v_price * v_quantity, 2);
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
        'source', 'combo', 'reserved_quantity', 0, 'cost', null, 'children', v_children
      );
    else
      v_source := coalesce(v_item ->> 'source', 'stock')::public.sale_line_source;
      v_reserved := coalesce((v_item ->> 'reserved_quantity')::numeric, 0);
      if v_source = 'combo' then
        raise exception '"%" no es un combo.', v_product.name;
      end if;
      if v_product.fulfillment_type = 'stock' and v_source <> 'stock' then
        raise exception '"%" se vende solo de inventario.', v_product.name;
      end if;
      if v_product.fulfillment_type = 'made_to_order' and v_source <> 'made_to_order' then
        raise exception '"%" se vende solo por encargo.', v_product.name;
      end if;
      if v_reserved < 0 or v_reserved > v_quantity or (v_reserved > 0 and v_source <> 'made_to_order') then
        raise exception 'Piezas apartadas inválidas en "%".', v_product.name;
      end if;

      v_products_subtotal := v_products_subtotal + round(v_price * v_quantity, 2);
      v_pieces := v_pieces + v_quantity;
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
        'source', v_source, 'reserved_quantity', v_reserved, 'cost', v_variant.unit_cost_usdt
      );
    end if;
  end loop;

  -- Descuento al mayor de productos: sobre los productos, por piezas.
  v_volume_percent := public.volume_discount_percent('products', v_pieces);
  v_volume := round(v_products_subtotal * v_volume_percent / 100, 2);
  -- La personalización ya trae su propio descuento al mayor.
  v_subtotal := v_products_subtotal + round(coalesce(p_extra_subtotal_usd, 0), 2);

  -- Descuento manual sobre lo que queda (no sobre el delivery), con motivo y límite para staff.
  v_discount_base := v_subtotal - v_volume;
  if p_discount_type is not null and coalesce(p_discount_value, 0) > 0 then
    if coalesce(trim(p_discount_reason), '') = '' then
      raise exception 'Indica el motivo del descuento.';
    end if;
    v_discount := case p_discount_type
      when 'percent' then round(v_discount_base * least(p_discount_value, 100) / 100, 2)
      else round(p_discount_value, 2)
    end;
    if v_discount > v_discount_base then
      raise exception 'El descuento no puede superar el subtotal.';
    end if;
    if not v_is_management and v_discount_base > 0 then
      select staff_max_discount_percent into v_max_percent from public.sales_settings;
      if v_discount / v_discount_base * 100 > v_max_percent + 0.0001 then
        raise exception '%', format('El descuento máximo sin owner o admin es %s%%.', trim_scale(v_max_percent));
      end if;
    end if;
  end if;

  insert into public.sales (
    customer_id, channel, price_method_id, delivery_method,
    subtotal_usd, volume_discount_percent, volume_discount_usd,
    discount_type, discount_value, discount_usd, discount_reason, discount_by,
    delivery_fee_usd, total_usd, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, notes,
    occurred_at, is_backdated
  )
  values (
    p_customer_id, p_channel, p_price_method_id, p_delivery_method,
    v_subtotal,
    case when v_volume > 0 then v_volume_percent else 0 end,
    v_volume,
    case when v_discount > 0 then p_discount_type end,
    case when v_discount > 0 then p_discount_value end,
    v_discount,
    case when v_discount > 0 then trim(p_discount_reason) end,
    case when v_discount > 0 then auth.uid() end,
    round(coalesce(p_delivery_fee_usd, 0), 2),
    v_subtotal - v_volume - v_discount + round(coalesce(p_delivery_fee_usd, 0), 2),
    v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt,
    nullif(trim(p_notes), ''),
    v_at, v_is_backdated
  )
  returning id into v_sale_id;

  perform set_config('app.creating_sale', v_sale_id::text, true);
  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.sale_items
      (sale_id, variant_id, quantity, unit_price_usd, line_total_usd, unit_cost_usdt, source, reserved_quantity)
    values (
      v_sale_id, (v_line ->> 'variant_id')::uuid, (v_line ->> 'quantity')::numeric, (v_line ->> 'price')::numeric,
      round((v_line ->> 'price')::numeric * (v_line ->> 'quantity')::numeric, 2),
      (v_line ->> 'cost')::numeric, (v_line ->> 'source')::public.sale_line_source,
      (v_line ->> 'reserved_quantity')::numeric
    )
    returning id into v_item_id;
    v_top_ids := v_top_ids || to_jsonb(v_item_id);

    if v_line ->> 'source' = 'combo' then
      v_parent_id := v_item_id;
      for v_child in select * from jsonb_array_elements(v_line -> 'children') loop
        insert into public.sale_items
          (sale_id, parent_item_id, variant_id, quantity, unit_price_usd, line_total_usd, unit_cost_usdt, source, reserved_quantity)
        values (
          v_sale_id, v_parent_id, (v_child ->> 'variant_id')::uuid, (v_child ->> 'quantity')::numeric, 0, 0,
          (v_child ->> 'cost')::numeric, (v_child ->> 'source')::public.sale_line_source,
          (v_child ->> 'reserved_quantity')::numeric
        )
        returning id into v_item_id;
        perform public.sale_line_after_insert(v_item_id, v_child, v_at, p_delivered, p_is_order);
      end loop;
    else
      perform public.sale_line_after_insert(v_item_id, v_line, v_at, p_delivered, p_is_order);
    end if;
  end loop;
  perform set_config('app.creating_sale', '', true);
  perform set_config('app.last_sale_item_ids', v_top_ids::text, true);

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

-- Stock y estado inicial de una línea con variante física. Interna.
drop function public.sale_line_after_insert(uuid, jsonb, timestamptz, boolean);
create or replace function public.sale_line_after_insert(
  p_item_id uuid,
  p_line jsonb,
  p_occurred_at timestamptz,
  p_delivered boolean,
  p_is_order boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_stock numeric := case p_line ->> 'source'
    when 'stock' then (p_line ->> 'quantity')::numeric
    else coalesce((p_line ->> 'reserved_quantity')::numeric, 0)
  end;
begin
  -- Lo que sale del inventario: la línea completa si es de stock, o las piezas apartadas.
  if v_from_stock > 0 then
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id, occurred_at)
    values ((p_line ->> 'variant_id')::uuid, 'sale', -v_from_stock, (p_line ->> 'cost')::numeric, p_item_id, p_occurred_at);
  end if;

  insert into public.sale_item_status_events (sale_item_id, status)
  values (
    p_item_id,
    case
      when p_is_order or p_line ->> 'source' = 'made_to_order' then 'to_produce'
      when p_delivered then 'delivered'
      else 'ready'
    end::public.sale_item_status
  );
end;
$$;

-- Venta normal: misma firma de siempre, sobre el núcleo.
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
  p_delivered boolean default false,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where coalesce((i ->> 'reserved_quantity')::numeric, 0) > 0
       or exists (select 1 from jsonb_array_elements(coalesce(i -> 'components', '[]')) c
                  where coalesce((c ->> 'reserved_quantity')::numeric, 0) > 0)
  ) then
    raise exception 'Apartar piezas del inventario es solo para pedidos.';
  end if;
  return public.create_sale_core(
    p_channel, p_price_method_id, p_delivery_method, p_items, p_payments, p_customer_id,
    p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, p_delivered,
    p_occurred_at, 0, false
  );
end;
$$;

-- Lo que consume una línea por encargo: solo las piezas que se producen (no las apartadas).
create or replace function public.consume_for_sale_item(p_sale_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.sale_items;
  v_to_make numeric;
  v_sku text;
  v_cost numeric;
  v_run_id uuid;
begin
  select * into v_item from public.sale_items where id = p_sale_item_id;
  v_to_make := v_item.quantity - v_item.reserved_quantity;
  if v_item.source <> 'made_to_order' or v_to_make <= 0
     or exists (select 1 from public.production_runs where sale_item_id = p_sale_item_id) then
    return;
  end if;
  if not exists (
    select 1 from public.product_recipe_lines l
    join public.product_variants v on v.product_id = l.product_id
    where v.id = v_item.variant_id
  ) then
    return;
  end if;

  select sku into v_sku from public.product_variants where id = v_item.variant_id;
  select coalesce(sum(r.quantity * r.unit_cost_usdt), 0) into v_cost
  from public.recipe_requirements(v_item.variant_id, v_to_make, true) r;

  insert into public.production_runs (variant_id, quantity, unit_cost_usdt, sale_item_id, note)
  values (v_item.variant_id, v_to_make, round(v_cost / v_to_make, 6), p_sale_item_id, 'Encargo producido')
  returning id into v_run_id;

  perform set_config('app.creating_production', v_run_id::text, true);
  perform public.consume_recipe(v_run_id, v_item.variant_id, v_to_make, now(),
    'Encargo: ' || trim_scale(v_to_make) || ' × ' || v_sku);
  perform set_config('app.creating_production', '', true);
end;
$$;

-- ============================================================
-- Etapas de producción
-- ============================================================

create or replace function public.is_order_line(p_item public.sale_items)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.orders where sale_id = p_item.sale_id);
$$;

-- ¿La etapa aplica a esta línea de pedido?
create or replace function public.line_stage_applies(p_item public.sale_items, p_stage public.sale_item_status)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_item.source = 'combo' then false
    when p_stage in ('cutting', 'sewing') then p_item.source = 'made_to_order' and p_item.quantity > p_item.reserved_quantity
    when p_stage = 'customization' then exists (select 1 from public.sale_item_customizations where sale_item_id = p_item.id)
    else true
  end;
$$;

-- Piezas que pasan por una etapa (corte y confección solo las que se producen).
create or replace function public.line_stage_pieces(p_item public.sale_items, p_stage public.sale_item_status)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_stage in ('cutting', 'sewing') then p_item.quantity - p_item.reserved_quantity else p_item.quantity end;
$$;

-- Siguiente etapa que aplica (sin contar "entregado": se entrega el pedido completo).
create or replace function public.next_line_stage(p_item_id uuid)
returns public.sale_item_status
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item public.sale_items;
  v_current public.sale_item_status;
  v_stage public.sale_item_status;
begin
  select * into v_item from public.sale_items where id = p_item_id;
  select status into v_current from public.sale_item_current_status where sale_item_id = p_item_id;
  foreach v_stage in array enum_range(null::public.sale_item_status) loop
    if v_stage > v_current and v_stage <> 'delivered' and public.line_stage_applies(v_item, v_stage) then
      return v_stage;
    end if;
  end loop;
  return null;
end;
$$;

-- Pagado de una venta en USD de referencia.
create or replace function public.sale_paid_usd(p_sale_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(usd_amount), 0) from public.sale_payments where sale_id = p_sale_id;
$$;

-- Avanza una línea. En un pedido: solo a la siguiente etapa que aplica, con el abono cubierto
-- (o una excepción) para empezar, y consume la materia prima al terminar el corte.
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
  v_order public.orders;
  v_next public.sale_item_status;
  v_assignment public.production_assignments;
  v_member public.team_members;
  v_rate numeric;
  v_category uuid;
  v_pieces numeric;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_item from public.sale_items where id = p_sale_item_id for update;
  if not found then
    raise exception 'La línea no existe.';
  end if;
  if v_item.source = 'combo' then
    raise exception 'El estado se avanza en cada componente del combo.';
  end if;
  if exists (select 1 from public.sale_voids where sale_id = v_item.sale_id) then
    raise exception 'La venta está anulada.';
  end if;
  select status into v_current from public.sale_item_current_status where sale_item_id = p_sale_item_id;

  select * into v_order from public.orders where sale_id = v_item.sale_id;
  if not found then
    -- Venta normal (sin pedido): avanza libre hacia adelante, como antes.
    if v_current is not null and p_status <= v_current then
      raise exception 'El estado solo avanza (actual: %).', v_current;
    end if;
    if v_item.source = 'made_to_order' and p_status in ('ready', 'delivered') then
      perform public.consume_for_sale_item(p_sale_item_id);
    end if;
    insert into public.sale_item_status_events (sale_item_id, status, note)
    values (p_sale_item_id, p_status, nullif(trim(p_note), ''));
    return;
  end if;

  -- Pedido.
  if p_status = 'delivered' and coalesce(current_setting('app.delivering_order', true), '') <> v_order.sale_id::text then
    raise exception 'Se entrega el pedido completo, no línea por línea.';
  end if;
  if p_status <> 'delivered' then
    v_next := public.next_line_stage(p_sale_item_id);
    if v_next is distinct from p_status then
      raise exception 'La siguiente etapa de esta línea es %.', coalesce(v_next::text, 'entregar el pedido');
    end if;
  end if;

  -- Para empezar a producir hace falta el abono (o una excepción con motivo).
  if v_current = 'to_produce'
     and public.sale_paid_usd(v_order.sale_id) + 0.01 < v_order.deposit_required_usd
     and not exists (select 1 from public.order_overrides where sale_id = v_order.sale_id and kind = 'start_without_deposit') then
    raise exception 'Falta el abono para empezar: se requieren % USD y se han pagado %.',
      trim_scale(v_order.deposit_required_usd), trim_scale(round(public.sale_paid_usd(v_order.sale_id), 2));
  end if;

  -- Al terminar el corte se consume la materia prima.
  if v_current = 'cutting' then
    perform public.consume_for_sale_item(p_sale_item_id);
  end if;

  -- Se completa la asignación de la etapa que termina; a destajo, se cuentan las piezas.
  if v_current in ('cutting', 'sewing', 'customization', 'quality_check', 'packing') then
    select * into v_assignment from public.production_assignments
    where sale_item_id = p_sale_item_id and stage = v_current and completed_at is null;
    if found then
      v_pieces := public.line_stage_pieces(v_item, v_current);
      update public.production_assignments set completed_at = now(), pieces = v_pieces where id = v_assignment.id;
      if v_assignment.team_member_id is not null then
        select * into v_member from public.team_members where id = v_assignment.team_member_id;
        if v_member.pay_basis in ('piecework', 'both') then
          select p.category_id into v_category
          from public.product_variants v join public.products p on p.id = v.product_id
          where v.id = v_item.variant_id;
          select rate_usd into v_rate from public.piece_rates
          where product_category_id = v_category and stage = v_current and effective_from <= public.caracas_today()
          order by effective_from desc limit 1;
          if v_rate is not null then
            insert into public.piecework_entries
              (team_member_id, assignment_id, sale_item_id, stage, pieces, rate_usd, amount_usd, completed_at)
            values (v_member.id, v_assignment.id, p_sale_item_id, v_current, v_pieces, v_rate, round(v_pieces * v_rate, 2), now());
          end if;
        end if;
      end if;
    end if;
  end if;

  insert into public.sale_item_status_events (sale_item_id, status, note)
  values (p_sale_item_id, p_status, nullif(trim(p_note), ''));
end;
$$;

-- Asignar (o reasignar) una etapa de una línea a una persona o a un taller.
create or replace function public.assign_stage(
  p_sale_item_id uuid,
  p_stage public.sale_item_status,
  p_team_member_id uuid default null,
  p_supplier_id uuid default null,
  p_expected_date date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.sale_items;
  v_current public.sale_item_status;
  v_id uuid;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_item from public.sale_items where id = p_sale_item_id;
  if not found or not public.is_order_line(v_item) then
    raise exception 'Solo se asignan etapas de líneas de pedido.';
  end if;
  if exists (select 1 from public.order_cancellations where sale_id = v_item.sale_id) then
    raise exception 'El pedido está cancelado.';
  end if;
  if num_nonnulls(p_team_member_id, p_supplier_id) <> 1 then
    raise exception 'Asigna a una persona del equipo o a un taller.';
  end if;
  if p_stage not in ('cutting', 'sewing', 'customization', 'quality_check', 'packing')
     or not public.line_stage_applies(v_item, p_stage) then
    raise exception 'Esa etapa no aplica a esta línea.';
  end if;
  select status into v_current from public.sale_item_current_status where sale_item_id = p_sale_item_id;
  if v_current > p_stage then
    raise exception 'Esa etapa ya terminó.';
  end if;
  if p_team_member_id is not null and not exists (select 1 from public.team_members where id = p_team_member_id and is_active) then
    raise exception 'La persona no existe o está inactiva.';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id and is_active and kind = 'workshop') then
    raise exception 'El taller no existe, está inactivo o no es un taller.';
  end if;

  insert into public.production_assignments (sale_item_id, stage, team_member_id, supplier_id, expected_date, note)
  values (p_sale_item_id, p_stage, p_team_member_id, p_supplier_id, p_expected_date, nullif(trim(p_note), ''))
  on conflict (sale_item_id, stage) do update
    set team_member_id = excluded.team_member_id,
        supplier_id = excluded.supplier_id,
        expected_date = excluded.expected_date,
        note = excluded.note
    where public.production_assignments.completed_at is null
  returning id into v_id;
  if v_id is null then
    raise exception 'Esa etapa ya terminó.';
  end if;
  return v_id;
end;
$$;

-- ============================================================
-- Crear un pedido
-- ============================================================

-- Ítems: {variant_id, quantity, components?, customizations?: [{type_id, quantity?, text?, logo_path?,
--   position?, size_cm?, note?, names?: [..]}]}.
-- Modo de stock: reservar lo que hay y producir lo que falta, o producir todo desde cero.
create or replace function public.create_order(
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
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.order_settings;
  v_today date := public.caracas_today();
  v_promised date;
  v_item jsonb;
  v_component jsonb;
  v_custom jsonb;
  v_items jsonb := '[]';
  v_components jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_qty numeric;
  v_reserve numeric;
  v_used jsonb := '{}';
  v_type public.customization_types;
  v_custom_qty numeric;
  v_type_totals jsonb := '{}';
  v_extra numeric := 0;
  v_sale_id uuid;
  v_ids jsonb;
  v_index integer := 0;
  v_custom_id uuid;
  v_names jsonb;
  v_ord integer;
  v_percent numeric;
  v_total numeric;
  v_payment jsonb;
  v_customer public.customers;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar pedidos.' using errcode = '42501';
  end if;
  if p_customer_id is null then
    raise exception 'Un pedido necesita cliente.';
  end if;
  select * into v_customer from public.customers where id = p_customer_id;
  if found and v_customer.blocked_at is not null then
    raise exception 'Cliente bloqueado: no se le puede vender. Motivo: %', coalesce(v_customer.blocked_reason, '—');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

  select * into v_settings from public.order_settings;
  v_promised := coalesce(p_promised_date, v_today + v_settings.default_lead_days);
  if v_promised < v_today then
    raise exception 'La fecha prometida no puede ser pasada.';
  end if;

  -- 1. Origen de cada pieza según el modo de stock.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;
    select * into v_product from public.products where id = v_variant.product_id;

    if v_product.kind = 'combo' then
      if jsonb_array_length(coalesce(v_item -> 'customizations', '[]')) > 0 then
        raise exception 'La personalización va en productos sueltos, no en combos.';
      end if;
      v_components := '[]';
      for v_component in select * from jsonb_array_elements(coalesce(v_item -> 'components', '[]')) loop
        declare
          v_c_variant public.product_variants;
          v_c_product public.products;
          v_c_qty numeric := (v_component ->> 'quantity')::numeric;
          v_c_free numeric;
          v_c_reserve numeric := 0;
          v_c_source text;
        begin
          select * into v_c_variant from public.product_variants where id = (v_component ->> 'variant_id')::uuid;
          select * into v_c_product from public.products where id = v_c_variant.product_id;
          if v_c_product.id is null then
            raise exception 'Un componente ya no existe.';
          end if;
          select coalesce(sum(quantity), 0) - coalesce((v_used ->> v_c_variant.id::text)::numeric, 0) into v_c_free
          from public.stock_movements where variant_id = v_c_variant.id;
          if v_c_product.fulfillment_type = 'stock' then
            v_c_source := 'stock';
            if p_stock_mode = 'produce_all' then
              raise exception '"%" solo se vende de inventario: usa "reservar y producir lo que falta".', v_c_product.name;
            end if;
            v_c_reserve := v_c_qty;
          else
            v_c_source := 'made_to_order';
            if p_stock_mode = 'reserve_and_produce' and v_c_product.fulfillment_type = 'both' then
              v_c_reserve := least(v_c_qty, greatest(v_c_free, 0));
            end if;
          end if;
          v_used := v_used || jsonb_build_object(v_c_variant.id::text, coalesce((v_used ->> v_c_variant.id::text)::numeric, 0) + v_c_reserve);
          v_components := v_components || jsonb_build_object(
            'variant_id', v_c_variant.id, 'quantity', v_c_qty, 'source', v_c_source,
            'reserved_quantity', case when v_c_source = 'made_to_order' then v_c_reserve else 0 end
          );
        end;
      end loop;
      v_items := v_items || jsonb_build_object('variant_id', v_variant.id, 'quantity', v_item -> 'quantity', 'components', v_components);
    else
      v_qty := (v_item ->> 'quantity')::numeric;
      select coalesce(sum(quantity), 0) - coalesce((v_used ->> v_variant.id::text)::numeric, 0) into v_reserve
      from public.stock_movements where variant_id = v_variant.id;
      if v_product.fulfillment_type = 'stock' then
        if p_stock_mode = 'produce_all' then
          raise exception '"%" solo se vende de inventario: usa "reservar y producir lo que falta".', v_product.name;
        end if;
        v_used := v_used || jsonb_build_object(v_variant.id::text, coalesce((v_used ->> v_variant.id::text)::numeric, 0) + v_qty);
        v_items := v_items || jsonb_build_object('variant_id', v_variant.id, 'quantity', v_qty, 'source', 'stock');
      else
        v_reserve := case when p_stock_mode = 'reserve_and_produce' and v_product.fulfillment_type = 'both'
                          then least(v_qty, greatest(v_reserve, 0)) else 0 end;
        v_used := v_used || jsonb_build_object(v_variant.id::text, coalesce((v_used ->> v_variant.id::text)::numeric, 0) + v_reserve);
        v_items := v_items || jsonb_build_object(
          'variant_id', v_variant.id, 'quantity', v_qty, 'source', 'made_to_order', 'reserved_quantity', v_reserve
        );
      end if;

      -- Personalización: tipo activo y con precio, medida y datos completos.
      for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
        select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
        if not found or not v_type.is_active then
          raise exception 'Una personalización no existe o está inactiva.';
        end if;
        if v_type.unit_price_usd is null then
          raise exception '"%" todavía no tiene precio: owner o admin debe cargarlo en Configuración.', v_type.name;
        end if;
        v_custom_qty := coalesce((v_custom ->> 'quantity')::numeric, v_qty);
        if v_custom_qty <= 0 or v_custom_qty > v_qty then
          raise exception '"%": la cantidad debe estar entre 1 y las piezas de la línea.', v_type.name;
        end if;
        if v_type.max_size_cm is not null and (v_custom ->> 'size_cm')::numeric > v_type.max_size_cm then
          raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
        end if;
        if v_type.requires_logo and coalesce(v_custom ->> 'logo_path', '') = '' then
          raise exception '"%" necesita el archivo del logo.', v_type.name;
        end if;
        v_names := coalesce(v_custom -> 'names', '[]');
        if v_type.requires_text and coalesce(trim(v_custom ->> 'text'), '') = '' and jsonb_array_length(v_names) = 0 then
          raise exception '"%" necesita el texto o la lista de nombres.', v_type.name;
        end if;
        if jsonb_array_length(v_names) > 0 and jsonb_array_length(v_names) <> v_custom_qty then
          raise exception '"%": van % nombres para % piezas.', v_type.name, jsonb_array_length(v_names), trim_scale(v_custom_qty);
        end if;
        v_type_totals := v_type_totals || jsonb_build_object(
          v_type.id::text, coalesce((v_type_totals ->> v_type.id::text)::numeric, 0) + v_custom_qty
        );
      end loop;
    end if;
  end loop;

  -- 2. Mínimos por tipo y total de personalización (con su descuento al mayor por tipo).
  for v_type in select * from public.customization_types where v_type_totals ? id::text loop
    v_custom_qty := (v_type_totals ->> v_type.id::text)::numeric;
    if v_custom_qty < v_type.min_quantity then
      raise exception '"%" es desde % piezas por pedido (van %).', v_type.name, v_type.min_quantity, trim_scale(v_custom_qty);
    end if;
    v_percent := public.volume_discount_percent('customization', v_custom_qty);
    v_extra := v_extra + round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2);
  end loop;

  -- 3. La venta (sin pagos todavía: el abono se calcula con el total final).
  v_sale_id := public.create_sale_core(
    p_channel, p_price_method_id, p_delivery_method, v_items, '[]', p_customer_id,
    p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, false,
    p_occurred_at, v_extra, true
  );
  v_ids := current_setting('app.last_sale_item_ids', true)::jsonb;

  -- 4. Personalización de cada línea.
  for v_item in select * from jsonb_array_elements(p_items) loop
    for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
      select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
      v_custom_qty := coalesce((v_custom ->> 'quantity')::numeric, (v_item ->> 'quantity')::numeric);
      v_percent := public.volume_discount_percent('customization', (v_type_totals ->> v_type.id::text)::numeric);
      insert into public.sale_item_customizations
        (sale_item_id, customization_type_id, quantity, text, logo_path, position, size_cm, note,
         unit_price_usd, discount_percent, line_total_usd)
      values (
        (v_ids ->> v_index)::uuid, v_type.id, v_custom_qty,
        nullif(trim(v_custom ->> 'text'), ''), nullif(v_custom ->> 'logo_path', ''),
        nullif(trim(v_custom ->> 'position'), ''), (v_custom ->> 'size_cm')::numeric, nullif(trim(v_custom ->> 'note'), ''),
        v_type.unit_price_usd, v_percent, round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2)
      )
      returning id into v_custom_id;
      v_ord := 0;
      for v_names in select * from jsonb_array_elements(coalesce(v_custom -> 'names', '[]')) loop
        v_ord := v_ord + 1;
        insert into public.sale_item_customization_names (customization_id, ordinal, name)
        values (v_custom_id, v_ord, trim(v_names #>> '{}'));
      end loop;
    end loop;
    v_index := v_index + 1;
  end loop;

  -- 5. Pedido, con el abono fijado al total final.
  select total_usd into v_total from public.sales where id = v_sale_id;
  insert into public.orders (sale_id, promised_date, stock_mode, deposit_required_usd)
  values (
    v_sale_id, v_promised, p_stock_mode,
    case when v_total >= v_settings.deposit_threshold_usd
         then round(v_total * v_settings.deposit_percent / 100, 2) else v_total end
  );

  -- 6. Pagos iniciales, con la fecha del pedido.
  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    perform public.apply_sale_payment(
      v_sale_id, (v_payment ->> 'payment_method_id')::uuid, (v_payment ->> 'amount')::numeric,
      nullif(v_payment ->> 'receipt_path', ''), coalesce(p_occurred_at, now())
    );
  end loop;

  return v_sale_id;
end;
$$;

-- Empezar a producir sin el abono completo: owner o admin, con motivo.
create or replace function public.allow_order_without_deposit(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin autorizan producir sin el abono.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders where sale_id = p_sale_id) then
    raise exception 'El pedido no existe.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo.';
  end if;
  insert into public.order_overrides (sale_id, kind, reason) values (p_sale_id, 'start_without_deposit', trim(p_reason))
  on conflict (sale_id, kind) do nothing;
end;
$$;

create or replace function public.change_order_promised_date(p_sale_id uuid, p_date date, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where sale_id = p_sale_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_order.delivered_at is not null or exists (select 1 from public.order_cancellations where sale_id = p_sale_id) then
    raise exception 'El pedido ya está cerrado.';
  end if;
  if p_date is null or p_date < public.caracas_today() then
    raise exception 'La fecha prometida no puede ser pasada.';
  end if;
  if p_date = v_order.promised_date then
    return;
  end if;
  insert into public.order_date_changes (sale_id, previous_date, new_date, reason)
  values (p_sale_id, v_order.promised_date, p_date, nullif(trim(p_reason), ''));
  update public.orders set promised_date = p_date where sale_id = p_sale_id;
end;
$$;

-- Entregar el pedido completo. Con saldo: se pide el pago; si no, owner o admin con motivo.
create or replace function public.deliver_order(p_sale_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_total numeric;
  v_balance numeric;
  v_item record;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where sale_id = p_sale_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_order.delivered_at is not null then
    raise exception 'El pedido ya fue entregado.';
  end if;
  if exists (select 1 from public.order_cancellations where sale_id = p_sale_id) then
    raise exception 'El pedido está cancelado.';
  end if;
  if exists (
    select 1 from public.sale_items i join public.sale_item_current_status cs on cs.sale_item_id = i.id
    where i.sale_id = p_sale_id and i.source <> 'combo' and cs.status <> 'ready'
  ) then
    raise exception 'Hay líneas que aún no están listas para entregar.';
  end if;

  select total_usd into v_total from public.sales where id = p_sale_id;
  v_balance := v_total - public.sale_paid_usd(p_sale_id);
  if v_balance > 0.01 then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Queda un saldo de % USD: registra el pago antes de entregar.', trim_scale(round(v_balance, 2));
    end if;
    if not public.has_role(array['owner', 'admin']::public.app_role[]) then
      raise exception 'Con saldo pendiente, solo owner o admin confirman la entrega.' using errcode = '42501';
    end if;
    insert into public.order_overrides (sale_id, kind, reason) values (p_sale_id, 'deliver_with_balance', trim(p_reason))
    on conflict (sale_id, kind) do nothing;
  end if;

  perform set_config('app.delivering_order', p_sale_id::text, true);
  for v_item in select id from public.sale_items where sale_id = p_sale_id and source <> 'combo' loop
    perform public.set_sale_item_status(v_item.id, 'delivered');
  end loop;
  update public.orders set delivered_at = now() where sale_id = p_sale_id;
  perform set_config('app.delivering_order', '', true);
end;
$$;

-- ============================================================
-- Cancelar un pedido
-- ============================================================

-- ¿Ya empezó la producción? (se consumió materia prima o alguna línea pasó del corte)
create or replace function public.order_production_started(p_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.production_runs r join public.sale_items i on i.id = r.sale_item_id where i.sale_id = p_sale_id
  ) or exists (
    select 1 from public.sale_items i join public.sale_item_current_status cs on cs.sale_item_id = i.id
    where i.sale_id = p_sale_id and cs.status > 'cutting' and i.source = 'made_to_order' and i.quantity > i.reserved_quantity
  );
$$;

-- Lo que se sugiere no devolver al cancelar: materiales consumidos + servicios de taller del pedido.
create or replace function public.order_cancellation_quote(p_sale_id uuid)
returns table (paid_usdt numeric, materials_usdt numeric, workshops_usdt numeric, suggested_deduction_usdt numeric, production_started boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with paid as (select coalesce(sum(usdt_value), 0) as v from public.sale_payments where sale_id = p_sale_id),
  materials as (
    select coalesce(sum(r.quantity * r.unit_cost_usdt), 0) as v
    from public.production_runs r join public.sale_items i on i.id = r.sale_item_id where i.sale_id = p_sale_id
  ),
  workshops as (
    select coalesce(sum(p.total_usd * p.usd_usdt_rate), 0) as v
    from public.purchase_order_links l join public.purchases p on p.id = l.purchase_id
    where l.sale_id = p_sale_id and not exists (select 1 from public.purchase_voids pv where pv.purchase_id = p.id)
  )
  select round(paid.v, 6), round(materials.v, 6), round(workshops.v, 6),
         round(least(paid.v, materials.v + workshops.v), 6), public.order_production_started(p_sale_id)
  from paid, materials, workshops
  where public.has_role(array['owner', 'admin', 'staff']::public.app_role[]);
$$;

create or replace function public.cancel_order(p_sale_id uuid, p_reason text, p_deduction_usdt numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_sale public.sales;
  v_started boolean;
  v_deduction numeric := 0;
  v_paid_usdt numeric;
  v_factor numeric := 1;
  v_refunded numeric := 0;
  v_payment record;
  v_entry public.ledger_entries;
  v_refund numeric;
  v_move record;
  v_label text;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la cancelación.';
  end if;
  select * into v_order from public.orders where sale_id = p_sale_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_order.delivered_at is not null then
    raise exception 'El pedido ya fue entregado: no se cancela.';
  end if;
  if exists (select 1 from public.order_cancellations where sale_id = p_sale_id) then
    raise exception 'El pedido ya está cancelado.';
  end if;
  select * into v_sale from public.sales where id = p_sale_id;
  v_label := 'NE-' || lpad(v_sale.number::text, 6, '0');

  -- Después del corte: solo owner o admin, y confirman cuánto no se devuelve.
  v_started := public.order_production_started(p_sale_id);
  if v_started then
    if not public.has_role(array['owner', 'admin']::public.app_role[]) then
      raise exception 'La producción ya empezó: solo owner o admin cancelan, con el descuento de materiales.' using errcode = '42501';
    end if;
    if p_deduction_usdt is null or p_deduction_usdt < 0 then
      raise exception 'Indica cuánto no se devuelve (materiales y talleres), en USDT.';
    end if;
    v_deduction := p_deduction_usdt;
  end if;

  select coalesce(sum(usdt_value), 0) into v_paid_usdt from public.sale_payments where sale_id = p_sale_id;
  if v_deduction > v_paid_usdt + 0.000001 then
    raise exception 'El descuento no puede pasar lo pagado (% USDT).', trim_scale(round(v_paid_usdt, 2));
  end if;
  if v_paid_usdt > 0 then
    v_factor := 1 - v_deduction / v_paid_usdt;
  end if;

  -- Cada pago se devuelve en su moneda y a su cuenta, con sus tasas (proporcional al descuento).
  perform set_config('app.refunding_sale', p_sale_id::text, true);
  for v_payment in
    select sp.amount, l.account_id, l.category_id, l.bcv_usd_rate, l.binance_rate, l.usd_usdt_rate
    from public.sale_payments sp join public.ledger_entries l on l.id = sp.ledger_entry_id
    where sp.sale_id = p_sale_id
  loop
    v_refund := round(v_payment.amount * v_factor, 2);
    if v_refund > 0 then
      insert into public.ledger_entries
        (account_id, entry_type, category_id, amount, occurred_at, description, bcv_usd_rate, binance_rate, usd_usdt_rate)
      values (
        v_payment.account_id, 'sale_refund', v_payment.category_id, -v_refund, now(),
        'Reembolso por cancelación de ' || v_label || ': ' || trim(p_reason),
        v_payment.bcv_usd_rate, v_payment.binance_rate, v_payment.usd_usdt_rate
      )
      returning * into v_entry;
      v_refunded := v_refunded - v_entry.usdt_value;
    end if;
  end loop;
  perform set_config('app.refunding_sale', '', true);

  -- El inventario apartado vuelve.
  perform set_config('app.creating_sale', p_sale_id::text, true);
  for v_move in
    select m.variant_id, m.quantity, m.unit_cost_usdt, m.sale_item_id
    from public.stock_movements m join public.sale_items i on i.id = m.sale_item_id
    where i.sale_id = p_sale_id and m.movement_type = 'sale'
  loop
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id, note)
    values (v_move.variant_id, 'sale_reversal', -v_move.quantity, v_move.unit_cost_usdt, v_move.sale_item_id,
            'Cancelación de ' || v_label);
  end loop;
  perform set_config('app.creating_sale', '', true);

  insert into public.order_cancellations (sale_id, reason, production_started, deduction_usdt, refunded_usdt)
  values (p_sale_id, trim(p_reason), v_started, v_deduction, round(v_refunded, 6));
  -- La venta queda anulada (no cuenta en ventas ni márgenes); el libro guarda pago y reembolso.
  insert into public.sale_voids (sale_id, reason) values (p_sale_id, 'Pedido cancelado: ' || trim(p_reason));

  -- Regla de negocio: cliente con reembolso por cancelación queda bloqueado.
  if v_refunded > 0 and v_sale.customer_id is not null then
    perform public.set_customer_block(v_sale.customer_id, 'block', 'Canceló el pedido ' || v_label || ' con reembolso.', p_sale_id);
  end if;
end;
$$;

-- Vincular un servicio de taller (compra) a un pedido: owner y admin.
create or replace function public.link_purchase_to_order(p_purchase_id uuid, p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin vinculan compras a pedidos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders where sale_id = p_sale_id) then
    raise exception 'El pedido no existe.';
  end if;
  insert into public.purchase_order_links (purchase_id, sale_id) values (p_purchase_id, p_sale_id)
  on conflict do nothing;
end;
$$;

-- ============================================================
-- Destajo: pago
-- ============================================================

-- Paga las piezas pendientes elegidas (y descuenta adelantos) como un pago de sueldo.
create or replace function public.register_piecework_payment(
  p_team_member_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_piecework_ids uuid[],
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
  v_payroll_id uuid;
  v_count integer;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin registran pagos al equipo.' using errcode = '42501';
  end if;
  if p_piecework_ids is null or cardinality(p_piecework_ids) = 0 then
    raise exception 'Elige las piezas a pagar.';
  end if;
  select count(*) into v_count
  from public.piecework_entries e
  where e.id = any (p_piecework_ids) and e.team_member_id = p_team_member_id
    and not exists (select 1 from public.piecework_settlements s where s.piecework_entry_id = e.id);
  if v_count <> cardinality(p_piecework_ids) then
    raise exception 'Alguna pieza no es de esta persona o ya se pagó.';
  end if;

  v_payroll_id := public.register_salary_payment(
    p_team_member_id, p_account_id, p_amount, 'Destajo', p_settle_advance_ids, p_note, p_occurred_at, p_receipt_path
  );
  insert into public.piecework_settlements (piecework_entry_id, payroll_entry_id)
  select unnest(p_piecework_ids), v_payroll_id;
  return v_payroll_id;
end;
$$;

-- ============================================================
-- Vistas y planificación
-- ============================================================

-- Pedidos con su estado derivado.
create view public.orders_overview
with (security_invoker = true)
as
select
  o.sale_id,
  s.number,
  s.customer_id,
  s.occurred_at,
  o.promised_date,
  o.stock_mode,
  o.deposit_required_usd,
  s.total_usd,
  coalesce(p.paid_usd, 0)::numeric(20, 6) as paid_usd,
  greatest(s.total_usd - coalesce(p.paid_usd, 0), 0)::numeric(20, 6) as balance_usd,
  (coalesce(p.paid_usd, 0) + 0.01 >= o.deposit_required_usd
    or exists (select 1 from public.order_overrides ov where ov.sale_id = o.sale_id and ov.kind = 'start_without_deposit')) as can_start,
  o.delivered_at,
  c.created_at as cancelled_at,
  (select min(cs.status) from public.sale_items i join public.sale_item_current_status cs on cs.sale_item_id = i.id
   where i.sale_id = o.sale_id and i.source <> 'combo') as min_stage,
  case
    when c.sale_id is not null then 'cancelled'
    when o.delivered_at is not null then 'delivered'
    when not exists (select 1 from public.sale_items i join public.sale_item_current_status cs on cs.sale_item_id = i.id
                     where i.sale_id = o.sale_id and i.source <> 'combo' and cs.status <> 'ready') then 'ready'
    when exists (select 1 from public.sale_items i join public.sale_item_current_status cs on cs.sale_item_id = i.id
                 where i.sale_id = o.sale_id and i.source <> 'combo' and cs.status > 'to_produce') then 'in_production'
    else 'waiting'
  end as status,
  (c.sale_id is null and o.delivered_at is null and o.promised_date < public.caracas_today()) as is_late
from public.orders o
join public.sales s on s.id = o.sale_id
left join (select sale_id, sum(usd_amount) as paid_usd from public.sale_payments group by sale_id) p on p.sale_id = o.sale_id
left join public.order_cancellations c on c.sale_id = o.sale_id;

-- Etapas abiertas: quién tiene qué (incluye talleres atrasados).
create view public.production_queue
with (security_invoker = true)
as
select
  i.id as sale_item_id,
  i.sale_id,
  s.number,
  o.promised_date,
  i.variant_id,
  i.quantity,
  i.reserved_quantity,
  cs.status as stage,
  a.id as assignment_id,
  a.team_member_id,
  a.supplier_id,
  a.expected_date,
  (a.supplier_id is not null and a.expected_date < public.caracas_today()) as workshop_late,
  (o.promised_date < public.caracas_today()) as order_late
from public.sale_items i
join public.orders o on o.sale_id = i.sale_id
join public.sales s on s.id = i.sale_id
join public.sale_item_current_status cs on cs.sale_item_id = i.id
left join public.production_assignments a on a.sale_item_id = i.id and a.stage = cs.status and a.completed_at is null
where i.source <> 'combo'
  and o.delivered_at is null
  and not exists (select 1 from public.order_cancellations c where c.sale_id = i.sale_id)
  and cs.status not in ('ready', 'delivered');

-- Piezas a destajo sin pagar.
create view public.pending_piecework
with (security_invoker = true)
as
select e.*
from public.piecework_entries e
where not exists (select 1 from public.piecework_settlements s where s.piecework_entry_id = e.id);

-- Material que necesitan los pedidos que aún no se cortan, contra lo que hay.
create or replace function public.material_requirements()
returns table (
  raw_variant_id uuid,
  sku text,
  material_name text,
  color_name text,
  unit public.product_unit,
  required numeric,
  available numeric,
  shortage numeric,
  lines integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with pending as (
    select i.id, i.variant_id, i.quantity - i.reserved_quantity as to_make
    from public.sale_items i
    join public.orders o on o.sale_id = i.sale_id
    join public.sale_item_current_status cs on cs.sale_item_id = i.id
    where i.source = 'made_to_order'
      and i.quantity > i.reserved_quantity
      and cs.status <= 'cutting'
      and o.delivered_at is null
      and not exists (select 1 from public.order_cancellations c where c.sale_id = i.sale_id)
      and not exists (select 1 from public.production_runs r where r.sale_item_id = i.id)
  ),
  needs as (
    select r.raw_variant_id, sum(r.quantity) as required, count(distinct p.id)::integer as lines
    from pending p
    cross join lateral public.recipe_requirements(p.variant_id, p.to_make, false) r
    group by r.raw_variant_id
  )
  select
    n.raw_variant_id,
    v.sku,
    coalesce(pr.name, 'Material sin color definido'),
    c.name,
    coalesce(pr.unit, 'unit'),
    round(n.required, 3),
    round(coalesce(b.quantity, 0), 3),
    round(greatest(n.required - coalesce(b.quantity, 0), 0), 3),
    n.lines
  from needs n
  left join public.product_variants v on v.id = n.raw_variant_id
  left join public.products pr on pr.id = v.product_id
  left join public.colors c on c.id = v.color_id
  left join public.stock_balances b on b.variant_id = n.raw_variant_id
  where public.has_role(array['owner', 'admin', 'staff']::public.app_role[])
  order by 8 desc, 3;
$$;

-- ============================================================
-- RLS y permisos
-- ============================================================

do $$
declare
  t text;
begin
  -- Lectura para todo el equipo.
  foreach t in array array[
    'order_settings', 'orders', 'order_overrides', 'order_cancellations', 'order_date_changes', 'purchase_order_links',
    'sale_item_customizations', 'sale_item_customization_names', 'production_assignments', 'customer_block_events',
    'business_rules', 'business_rule_revisions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: todo el equipo los ve" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'', ''staff'']::public.app_role[]))', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;

  -- Destajo: solo owner y admin.
  foreach t in array array['piece_rates', 'piecework_entries', 'piecework_settlements']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: owner y admin" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end;
$$;

create policy "order_settings: owner y admin editan" on public.order_settings for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
grant update (deposit_threshold_usd, deposit_percent, default_lead_days) on public.order_settings to authenticated;

create policy "piece_rates: owner y admin crean" on public.piece_rates for insert to authenticated
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
grant insert (product_category_id, stage, rate_usd, effective_from) on public.piece_rates to authenticated;

create policy "business_rules: owner y admin crean" on public.business_rules for insert to authenticated
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "business_rules: owner y admin editan" on public.business_rules for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
grant insert (title, body, enforced_by_system, sort_order, is_active),
      update (title, body, enforced_by_system, sort_order, is_active)
  on public.business_rules to authenticated;

-- Columnas nuevas editables en tablas existentes.
grant insert (kind), update (kind) on public.suppliers to authenticated;
grant insert (pay_basis), update (pay_basis) on public.team_members to authenticated;

revoke all on public.orders_overview, public.production_queue, public.pending_piecework from anon, authenticated;
grant select on public.orders_overview, public.production_queue, public.pending_piecework to authenticated;

-- Internas: nadie las llama directo.
revoke all on function
  public.create_sale_core(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
                          public.discount_type, numeric, text, text, boolean, timestamptz, numeric, boolean),
  public.sale_line_after_insert(uuid, jsonb, timestamptz, boolean, boolean),
  public.set_customer_block(uuid, public.customer_block_action, text, uuid),
  public.customers_guard_block(),
  public.customer_private_check_block(),
  public.orders_guard_update(),
  public.business_rules_log_revision()
from public, anon, authenticated;

revoke all on function
  public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                      jsonb, numeric, public.discount_type, numeric, text, text, timestamptz),
  public.assign_stage(uuid, public.sale_item_status, uuid, uuid, date, text),
  public.allow_order_without_deposit(uuid, text),
  public.change_order_promised_date(uuid, date, text),
  public.deliver_order(uuid, text),
  public.cancel_order(uuid, text, numeric),
  public.order_cancellation_quote(uuid),
  public.link_purchase_to_order(uuid, uuid),
  public.register_piecework_payment(uuid, uuid, numeric, uuid[], uuid[], text, timestamptz, text),
  public.block_customer(uuid, text),
  public.unblock_customer(uuid, text),
  public.blocked_customer_match(text, text, text),
  public.material_requirements(),
  public.next_line_stage(uuid),
  public.sale_paid_usd(uuid),
  public.order_production_started(uuid),
  public.is_order_line(public.sale_items),
  public.line_stage_applies(public.sale_items, public.sale_item_status),
  public.line_stage_pieces(public.sale_items, public.sale_item_status)
from public, anon;

grant execute on function
  public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                      jsonb, numeric, public.discount_type, numeric, text, text, timestamptz),
  public.assign_stage(uuid, public.sale_item_status, uuid, uuid, date, text),
  public.allow_order_without_deposit(uuid, text),
  public.change_order_promised_date(uuid, date, text),
  public.deliver_order(uuid, text),
  public.cancel_order(uuid, text, numeric),
  public.order_cancellation_quote(uuid),
  public.link_purchase_to_order(uuid, uuid),
  public.register_piecework_payment(uuid, uuid, numeric, uuid[], uuid[], text, timestamptz, text),
  public.block_customer(uuid, text),
  public.unblock_customer(uuid, text),
  public.blocked_customer_match(text, text, text),
  public.material_requirements(),
  public.next_line_stage(uuid),
  public.sale_paid_usd(uuid),
  public.order_production_started(uuid),
  public.is_order_line(public.sale_items),
  public.line_stage_applies(public.sale_items, public.sale_item_status),
  public.line_stage_pieces(public.sale_items, public.sale_item_status)
to authenticated;
