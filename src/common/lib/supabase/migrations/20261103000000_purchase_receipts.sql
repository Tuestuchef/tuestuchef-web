-- Compras por recibir: se le encarga algo a un taller o proveedor (p. ej. filipinas para el stock)
-- y la mercancía entra al inventario cuando la entrega, toda junta o por partes.
-- · to_receive: la compra no mete nada al stock al registrarse. expected_date: cuándo la entrega.
-- · Lo recibido de cada línea es la suma de sus entradas al stock (movimientos "purchase"):
--   receive_purchase agrega una entrada por lo que llega, con el costo de la línea.
-- · Lo pendiente se ve en "Quién tiene qué" bajo el proveedor (pending_purchase_receipts).
-- · Pagos, crédito y anulación funcionan igual (anular saca del stock solo lo que entró).

alter table public.purchases
  add column to_receive boolean not null default false,
  add column expected_date date;

alter table public.purchases add constraint purchases_expected_date_needs_receive
  check (expected_date is null or to_receive);

drop function public.create_purchase(uuid, jsonb, jsonb, date, text, text, timestamptz);

create function public.create_purchase(
  p_supplier_id uuid,
  p_items jsonb,
  p_payments jsonb default '[]',
  p_due_date date default null,
  p_notes text default null,
  p_receipt_path text default null,
  p_occurred_at timestamptz default null,
  -- Por recibir: la mercancía no entra al stock hasta que se recibe (receive_purchase).
  p_to_receive boolean default false,
  p_expected_date date default null
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

  if p_to_receive and not exists (
    select 1 from jsonb_array_elements(p_items) i where coalesce(i ->> 'line_type', 'inventory') = 'inventory'
  ) then
    raise exception 'Solo lo que entra al inventario se recibe después.';
  end if;
  if p_expected_date is not null and (not p_to_receive or p_expected_date < v_date) then
    raise exception 'La fecha de entrega va solo en compras por recibir, y no antes de la compra.';
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
    notes, receipt_path, occurred_at, is_backdated, to_receive, expected_date
  )
  values (
    p_supplier_id, v_total, p_due_date, v_rate.bcv_usd, v_rate.bcv_eur, v_rate.binance_usdt, v_rate.usd_usdt,
    nullif(trim(p_notes), ''), p_receipt_path, v_at, v_date < public.caracas_today(), coalesce(p_to_receive, false), p_expected_date
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

    if v_line ->> 'line_type' = 'inventory' and not coalesce(p_to_receive, false) then
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


-- Recibir lo que entregó el proveedor: [{item_id, quantity}], cada cantidad hasta lo pendiente.
create or replace function public.receive_purchase(p_purchase_id uuid, p_items jsonb, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_item jsonb;
  v_line public.purchase_items;
  v_quantity numeric;
  v_received numeric;
  v_any boolean := false;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'La compra no existe.';
  end if;
  if not v_purchase.to_receive then
    raise exception 'Esta compra ya entró al inventario al registrarse.';
  end if;
  if exists (select 1 from public.purchase_voids where purchase_id = p_purchase_id) then
    raise exception 'La compra está anulada.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Indica qué se recibió.';
  end if;

  perform set_config('app.creating_purchase', p_purchase_id::text, true);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if coalesce(v_quantity, 0) = 0 then
      continue;
    end if;
    select * into v_line from public.purchase_items
    where id = (v_item ->> 'item_id')::uuid and purchase_id = p_purchase_id and line_type = 'inventory';
    if not found then
      raise exception 'Una línea no es de esta compra.';
    end if;
    select coalesce(sum(quantity), 0) into v_received from public.stock_movements
    where purchase_item_id = v_line.id and movement_type = 'purchase';
    if v_quantity < 0 or v_received + v_quantity > v_line.quantity then
      raise exception 'Se pueden recibir hasta % de esa línea.', trim_scale(v_line.quantity - v_received);
    end if;
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, purchase_item_id, note)
    values (v_line.variant_id, 'purchase', v_quantity, v_line.unit_cost_usdt, v_line.id, nullif(trim(p_note), ''));
    v_any := true;
  end loop;
  perform set_config('app.creating_purchase', '', true);

  if not v_any then
    raise exception 'Indica cuánto se recibió.';
  end if;
end;
$$;

-- Lo que un proveedor o taller tiene por entregar: líneas de compras por recibir con algo pendiente.
create view public.pending_purchase_receipts
with (security_invoker = true)
as
select
  i.id as purchase_item_id,
  p.id as purchase_id,
  p.number,
  p.supplier_id,
  p.expected_date,
  p.occurred_at,
  i.variant_id,
  i.quantity,
  coalesce(r.received, 0) as received,
  i.quantity - coalesce(r.received, 0) as pending,
  (p.expected_date is not null and p.expected_date < public.caracas_today()) as is_late
from public.purchases p
join public.purchase_items i on i.purchase_id = p.id and i.line_type = 'inventory'
left join (
  select purchase_item_id, sum(quantity) as received
  from public.stock_movements where movement_type = 'purchase' and purchase_item_id is not null
  group by purchase_item_id
) r on r.purchase_item_id = i.id
where p.to_receive
  and not exists (select 1 from public.purchase_voids v where v.purchase_id = p.id)
  and i.quantity - coalesce(r.received, 0) > 0;

revoke all on public.pending_purchase_receipts from anon, authenticated;
grant select on public.pending_purchase_receipts to authenticated;

revoke execute on function
  public.create_purchase(uuid, jsonb, jsonb, date, text, text, timestamptz, boolean, date),
  public.receive_purchase(uuid, jsonb, text)
from public, anon;
grant execute on function
  public.create_purchase(uuid, jsonb, jsonb, date, text, text, timestamptz, boolean, date),
  public.receive_purchase(uuid, jsonb, text)
to authenticated;
