-- Editar una venta (owner y admin), con historial de cambios dentro de la misma venta.
-- · Datos sin dinero: cliente, canal, entrega y notas.
-- · Corregir un pago (otro método u otro monto) o quitarlo: el pago se revierte en su cuenta, con su
--   misma fecha, y el correcto se registra con esa fecha y las tasas de ese día.
-- · Productos, cantidades y precios no se editan: para eso se anula la venta y se hace otra.
-- · Siempre con motivo. No se edita una venta anulada, un pedido cancelado ni nada de un mes cerrado.
--
-- Los pagos siguen siendo inmutables. La tabla pasa a llamarse sale_payments_all (todos los pagos,
-- también los corregidos) y public.sale_payments es ahora la vista de los que cuentan: así todo lo que
-- ya suma pagos (saldo, abono de pedidos, cancelaciones, anulación, reportes) deja fuera los corregidos.

-- ============================================================
-- Historial
-- ============================================================

create table public.sale_edits (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  reason text not null check (length(trim(reason)) between 3 and 300),
  -- [{field, from, to}]: customer (nombre), channel, delivery_method, notes, o payment
  -- ({method, currency, amount} antes y después; to nulo si se quitó).
  changes jsonb not null check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index sale_edits_sale_idx on public.sale_edits (sale_id, created_at);

-- ============================================================
-- Pagos: todos (tabla) y los que cuentan (vista)
-- ============================================================

alter table public.sale_payments rename to sale_payments_all;

-- Un pago corregido o quitado: el reverso en el libro y el pago que lo reemplaza (si hay).
create table public.sale_payment_corrections (
  payment_id uuid primary key references public.sale_payments_all (id),
  edit_id uuid not null references public.sale_edits (id) deferrable initially deferred,
  reversal_entry_id uuid not null unique references public.ledger_entries (id),
  replacement_payment_id uuid unique references public.sale_payments_all (id),
  created_at timestamptz not null default now()
);

create view public.sale_payments
with (security_invoker = true)
as
select p.*
from public.sale_payments_all p
where not exists (select 1 from public.sale_payment_corrections c where c.payment_id = p.id);

-- Las vistas que suman pagos apuntaban a la tabla: ahora a la vista (mismo texto).
create or replace view public.sales_summary
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

create or replace view public.orders_overview
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

-- La venta de un movimiento del libro (para el IVA): también la de un pago corregido y su reverso.
create or replace function public.ledger_vat_ratio(p_entry public.ledger_entries)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select case when s.total_usd > 0 then s.vat_usd / s.total_usd else 0 end
    from public.sales s
    where s.id = coalesce(
      p_entry.sale_id,
      (select sp.sale_id from public.sale_payments_all sp where sp.ledger_entry_id = p_entry.id),
      (select sp.sale_id from public.sale_payments_all sp where sp.ledger_entry_id = p_entry.reverses_entry_id)
    )
  ), 0);
$$;

-- ============================================================
-- La venta: solo se cambian sus datos, y solo desde edit_sale_details
-- ============================================================

drop trigger sales_immutable on public.sales;

create trigger sales_no_delete before delete on public.sales
  for each row execute function public.prevent_mutation();

create or replace function public.sales_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.editing_sale', true), '') <> old.id::text
     or (to_jsonb(new) - array['customer_id', 'channel', 'delivery_method', 'notes'])
        is distinct from (to_jsonb(old) - array['customer_id', 'channel', 'delivery_method', 'notes']) then
    raise exception 'Los registros de sales no se editan ni se borran: se corrigen con un reverso.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger sales_guard_update before update on public.sales
  for each row execute function public.sales_guard_update();

-- Revertir el pago de una venta: al anularla o al corregir ese pago.
create or replace function public.ledger_entries_guard_sale_payment_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reverses_entry_id is not null
     and exists (select 1 from public.ledger_entries where id = new.reverses_entry_id and entry_type = 'sale_payment')
     and coalesce(current_setting('app.voiding_sale', true), '') = ''
     and coalesce(current_setting('app.correcting_payment', true), '') <> new.reverses_entry_id::text then
    raise exception 'Los pagos de una venta se revierten anulando la venta o corrigiendo el pago.';
  end if;
  return new;
end;
$$;

-- Lo común a toda edición: permiso, motivo y venta editable.
create or replace function public.sale_edit_check(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin editan ventas.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indica el motivo del cambio.';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if exists (select 1 from public.sale_voids where sale_id = p_sale_id) then
    raise exception 'La venta está anulada: no se edita.';
  end if;
  if exists (select 1 from public.order_cancellations where sale_id = p_sale_id) then
    raise exception 'El pedido está cancelado: no se edita.';
  end if;
  return v_sale;
end;
$$;

create or replace function public.customer_display_name(p_customer_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(c.legal_name), ''), trim(c.first_name || ' ' || coalesce(c.last_name, '')))
  from public.customers c where c.id = p_customer_id;
$$;

-- ============================================================
-- Editar los datos de la venta
-- ============================================================

create or replace function public.edit_sale_details(
  p_sale_id uuid,
  p_customer_id uuid,
  p_channel public.sale_channel,
  p_delivery_method public.delivery_method,
  p_notes text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_customer public.customers;
  v_notes text := nullif(trim(p_notes), '');
  v_changes jsonb := '[]';
  v_edit_id uuid;
begin
  v_sale := public.sale_edit_check(p_sale_id, p_reason);
  perform public.assert_period_open(v_sale.occurred_at);

  if p_customer_id is distinct from v_sale.customer_id then
    if p_customer_id is null and exists (select 1 from public.orders where sale_id = p_sale_id) then
      raise exception 'Un pedido necesita cliente.';
    end if;
    if p_customer_id is not null then
      select * into v_customer from public.customers where id = p_customer_id;
      if not found or not v_customer.is_active then
        raise exception 'El cliente no existe o está inactivo.';
      end if;
      if v_customer.blocked_at is not null then
        raise exception 'Cliente bloqueado: no se le puede vender. Motivo: %', coalesce(v_customer.blocked_reason, '—');
      end if;
    end if;
    v_changes := v_changes || jsonb_build_object(
      'field', 'customer',
      'from', public.customer_display_name(v_sale.customer_id),
      'to', public.customer_display_name(p_customer_id)
    );
  end if;
  if p_channel is null or p_delivery_method is null then
    raise exception 'Indica el canal y la entrega.';
  end if;
  if p_channel is distinct from v_sale.channel then
    v_changes := v_changes || jsonb_build_object('field', 'channel', 'from', v_sale.channel, 'to', p_channel);
  end if;
  if p_delivery_method is distinct from v_sale.delivery_method then
    if p_delivery_method = 'pickup' and v_sale.delivery_fee_usd > 0 then
      raise exception 'La venta cobró delivery: no puede quedar como retiro.';
    end if;
    v_changes := v_changes || jsonb_build_object('field', 'delivery_method', 'from', v_sale.delivery_method, 'to', p_delivery_method);
  end if;
  if v_notes is distinct from v_sale.notes then
    if length(v_notes) > 500 then
      raise exception 'Las notas van hasta 500 caracteres.';
    end if;
    v_changes := v_changes || jsonb_build_object('field', 'notes', 'from', v_sale.notes, 'to', v_notes);
  end if;

  if jsonb_array_length(v_changes) = 0 then
    raise exception 'No hay cambios que guardar.';
  end if;

  perform set_config('app.editing_sale', p_sale_id::text, true);
  update public.sales
  set customer_id = p_customer_id, channel = p_channel, delivery_method = p_delivery_method, notes = v_notes
  where id = p_sale_id;
  perform set_config('app.editing_sale', '', true);

  insert into public.sale_edits (sale_id, reason, changes)
  values (p_sale_id, trim(p_reason), v_changes)
  returning id into v_edit_id;
  return v_edit_id;
end;
$$;

-- ============================================================
-- Corregir o quitar un pago
-- ============================================================

-- p_payment_method_id nulo: quitar el pago (p. ej. quedó por cobrar). Si no, se reemplaza por ese
-- método y monto (en la moneda del método), con la misma fecha y comprobante.
create or replace function public.correct_sale_payment(
  p_payment_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.sale_payments_all;
  v_sale public.sales;
  v_label text;
  v_edit_id uuid := gen_random_uuid();
  v_reversal_id uuid;
  v_new_id uuid;
  v_new public.sale_payments_all;
  v_old_method text;
begin
  select * into v_payment from public.sale_payments_all where id = p_payment_id;
  if not found then
    raise exception 'El pago no existe.';
  end if;
  v_sale := public.sale_edit_check(v_payment.sale_id, p_reason);
  if exists (select 1 from public.sale_payment_corrections where payment_id = p_payment_id) then
    raise exception 'Ese pago ya se corrigió.';
  end if;
  if p_payment_method_id is not null and (p_amount is null or p_amount <= 0) then
    raise exception 'El monto del pago debe ser mayor que cero.';
  end if;
  if p_payment_method_id = v_payment.payment_method_id and p_amount = v_payment.amount then
    raise exception 'No hay cambios que guardar.';
  end if;
  v_label := 'NE-' || lpad(v_sale.number::text, 6, '0');

  -- 1. Reverso en la cuenta del pago, con su misma fecha (si el mes está cerrado, no pasa).
  perform set_config('app.correcting_payment', v_payment.ledger_entry_id::text, true);
  insert into public.ledger_entries (reverses_entry_id, description)
  values (v_payment.ledger_entry_id, 'Corrección de pago de ' || v_label || ': ' || trim(p_reason))
  returning id into v_reversal_id;
  perform set_config('app.correcting_payment', '', true);

  -- 2. Deja de contar (antes del pago nuevo, para que el saldo lo permita).
  insert into public.sale_payment_corrections (payment_id, edit_id, reversal_entry_id)
  values (p_payment_id, v_edit_id, v_reversal_id);

  -- 3. El correcto, con la fecha y el comprobante del original.
  if p_payment_method_id is not null then
    v_new_id := public.apply_sale_payment(
      v_payment.sale_id, p_payment_method_id, p_amount, v_payment.receipt_path, v_payment.occurred_at
    );
    select * into v_new from public.sale_payments_all where id = v_new_id;
  end if;

  select name into v_old_method from public.payment_methods where id = v_payment.payment_method_id;
  insert into public.sale_edits (id, sale_id, reason, changes)
  values (
    v_edit_id, v_payment.sale_id, trim(p_reason),
    jsonb_build_array(jsonb_build_object(
      'field', 'payment',
      'from', jsonb_build_object('method', v_old_method, 'currency', v_payment.currency, 'amount', v_payment.amount),
      'to', case when v_new_id is null then null else jsonb_build_object(
        'method', (select name from public.payment_methods where id = p_payment_method_id),
        'currency', v_new.currency, 'amount', v_new.amount
      ) end
    ))
  );

  -- El reemplazo queda ligado a la corrección (la fila se acaba de crear en esta misma operación).
  if v_new_id is not null then
    perform set_config('app.linking_correction', p_payment_id::text, true);
    update public.sale_payment_corrections set replacement_payment_id = v_new_id where payment_id = p_payment_id;
    perform set_config('app.linking_correction', '', true);
  end if;

  return v_edit_id;
end;
$$;

-- Correcciones: no se editan ni se borran (solo se liga el reemplazo, una vez, al crearla).
create or replace function public.sale_payment_corrections_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.linking_correction', true), '') <> old.payment_id::text
     or old.replacement_payment_id is not null
     or (to_jsonb(new) - 'replacement_payment_id') is distinct from (to_jsonb(old) - 'replacement_payment_id') then
    raise exception 'Los registros de sale_payment_corrections no se editan ni se borran.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger sale_payment_corrections_guard_update before update on public.sale_payment_corrections
  for each row execute function public.sale_payment_corrections_guard_update();
create trigger sale_payment_corrections_no_delete before delete on public.sale_payment_corrections
  for each row execute function public.prevent_mutation();
create trigger sale_payment_corrections_no_truncate before truncate on public.sale_payment_corrections
  for each statement execute function public.prevent_mutation();
create trigger sale_edits_immutable before update or delete on public.sale_edits
  for each row execute function public.prevent_mutation();
create trigger sale_edits_no_truncate before truncate on public.sale_edits
  for each statement execute function public.prevent_mutation();

-- ============================================================
-- RLS y permisos
-- ============================================================

alter table public.sale_edits enable row level security;
alter table public.sale_payment_corrections enable row level security;

create policy "sale_edits: todo el equipo los ve" on public.sale_edits
  for select to authenticated using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "sale_payment_corrections: todo el equipo las ve" on public.sale_payment_corrections
  for select to authenticated using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

revoke all on table public.sale_edits, public.sale_payment_corrections, public.sale_payments, public.sale_payments_all
from anon, authenticated;
grant select on public.sale_edits, public.sale_payment_corrections, public.sale_payments, public.sale_payments_all
to authenticated;

revoke all on function
  public.sales_guard_update(),
  public.sale_payment_corrections_guard_update(),
  public.sale_edit_check(uuid, text),
  public.customer_display_name(uuid)
from public, anon, authenticated;

revoke all on function
  public.edit_sale_details(uuid, uuid, public.sale_channel, public.delivery_method, text, text),
  public.correct_sale_payment(uuid, uuid, numeric, text)
from public, anon;
grant execute on function
  public.edit_sale_details(uuid, uuid, public.sale_channel, public.delivery_method, text, text),
  public.correct_sale_payment(uuid, uuid, numeric, text)
to authenticated;
