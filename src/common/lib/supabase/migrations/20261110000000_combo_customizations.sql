-- Personalizar las piezas de un combo (ej.: promo 10x10, 10 delantales con logo y 10 gorros con nombre).
-- · La personalización va en cada pieza del combo (sus componentes), no en el combo: cada pieza
--   lleva lo suyo, hasta las piezas de ese componente.
-- · En ventas, pedidos y presupuestos. Cada personalización se cobra aparte (precio del tipo, con su
--   descuento al mayor) o va incluida (solo anotada, p. ej. en el precio de la promo). Antes, en
--   pedidos y presupuestos siempre se cobraba.
-- · El mínimo de piezas por tipo (pedidos y presupuestos) cuenta todas, cobradas o incluidas.
-- · Al convertir un presupuesto en pedido, y al duplicarlo o versionarlo, la personalización de las
--   piezas pasa igual.

-- ============================================================
-- Presupuestos: cobrada o incluida
-- ============================================================

alter table public.quote_item_customizations add column charged boolean not null default true;
alter table public.quote_item_customizations drop constraint quote_item_customizations_unit_price_usd_check;
alter table public.quote_item_customizations add constraint quote_item_customizations_price_valid check (
  case when charged then unit_price_usd > 0 else unit_price_usd = 0 and line_total_usd = 0 end
);

-- ============================================================
-- Piezas de un combo ya creadas, en el orden de sus componentes
-- ============================================================

-- p_components: los componentes de la línea del combo, como se enviaron. Devuelve el id de la pieza
-- de cada uno (dos piezas iguales son intercambiables).
create or replace function public.combo_child_ids(p_parent_id uuid, p_components jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_component jsonb;
  v_id uuid;
  v_used uuid[] := '{}';
  v_ids jsonb := '[]';
begin
  for v_component in select * from jsonb_array_elements(coalesce(p_components, '[]')) loop
    select id into v_id from public.sale_items
    where parent_item_id = p_parent_id
      and variant_id = (v_component ->> 'variant_id')::uuid
      and not (id = any (v_used))
    order by (quantity = (v_component ->> 'quantity')::numeric) desc
    limit 1;
    if v_id is null then
      raise exception 'No se encontró una pieza del combo para su personalización.';
    end if;
    v_used := v_used || v_id;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;
  return v_ids;
end;
$$;

-- ============================================================
-- Validar una personalización
-- ============================================================

-- Ventas: sin mínimo ni archivo obligatorio; con precio si se cobra. Devuelve sus piezas.
create or replace function public.sale_customization_qty(p_custom jsonb, p_line_qty numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.customization_types;
  v_qty numeric;
  v_names jsonb := coalesce(p_custom -> 'names', '[]');
begin
  select * into v_type from public.customization_types where id = (p_custom ->> 'type_id')::uuid;
  if not found or not v_type.is_active then
    raise exception 'Una personalización no existe o está inactiva.';
  end if;
  v_qty := coalesce((p_custom ->> 'quantity')::numeric, p_line_qty);
  if v_qty <= 0 or v_qty > p_line_qty or v_qty <> trunc(v_qty) then
    raise exception '"%": las piezas van de 1 a las de la línea.', v_type.name;
  end if;
  if v_type.max_size_cm is not null and (p_custom ->> 'size_cm')::numeric > v_type.max_size_cm then
    raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
  end if;
  if coalesce(trim(p_custom ->> 'text'), '') = '' and jsonb_array_length(v_names) = 0
     and coalesce(p_custom ->> 'logo_path', '') = '' then
    raise exception '"%": escribe el nombre, el texto o qué logo lleva.', v_type.name;
  end if;
  if jsonb_array_length(v_names) > 0 and jsonb_array_length(v_names) <> v_qty then
    raise exception '"%": van % nombres para % piezas.', v_type.name, jsonb_array_length(v_names), trim_scale(v_qty);
  end if;
  if coalesce((p_custom ->> 'charged')::boolean, true) and v_type.unit_price_usd is null then
    raise exception '"%" todavía no tiene precio: anótala como incluida u owner o admin debe cargarlo.', v_type.name;
  end if;
  return v_qty;
end;
$$;

-- Pedidos: logo y texto según el tipo; con precio si se cobra (desde un presupuesto, el del presupuesto).
create or replace function public.order_customization_qty(p_custom jsonb, p_line_qty numeric, p_quote_mode boolean)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.customization_types;
  v_qty numeric;
  v_names jsonb := coalesce(p_custom -> 'names', '[]');
begin
  select * into v_type from public.customization_types where id = (p_custom ->> 'type_id')::uuid;
  if not found or not v_type.is_active then
    raise exception 'Una personalización no existe o está inactiva.';
  end if;
  if coalesce((p_custom ->> 'charged')::boolean, true) and v_type.unit_price_usd is null and not p_quote_mode then
    raise exception '"%" todavía no tiene precio: anótala como incluida u owner o admin debe cargarlo en Configuración.', v_type.name;
  end if;
  v_qty := coalesce((p_custom ->> 'quantity')::numeric, p_line_qty);
  if v_qty <= 0 or v_qty > p_line_qty then
    raise exception '"%": la cantidad debe estar entre 1 y las piezas de la línea.', v_type.name;
  end if;
  if v_type.max_size_cm is not null and (p_custom ->> 'size_cm')::numeric > v_type.max_size_cm then
    raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
  end if;
  if v_type.requires_logo and coalesce(p_custom ->> 'logo_path', '') = '' then
    raise exception '"%" necesita el archivo del logo.', v_type.name;
  end if;
  if v_type.requires_text and coalesce(trim(p_custom ->> 'text'), '') = '' and jsonb_array_length(v_names) = 0 then
    raise exception '"%" necesita el texto o la lista de nombres.', v_type.name;
  end if;
  if jsonb_array_length(v_names) > 0 and jsonb_array_length(v_names) <> v_qty then
    raise exception '"%": van % nombres para % piezas.', v_type.name, jsonb_array_length(v_names), trim_scale(v_qty);
  end if;
  return v_qty;
end;
$$;

-- ============================================================
-- Guardar la personalización de una venta o pedido
-- ============================================================

-- La de una línea o pieza. p_totals: piezas cobradas por tipo (para su descuento al mayor).
-- p_quote_id: si viene de un presupuesto, precio y cobro salen de él.
create or replace function public.sale_customizations_line(
  p_item_id uuid,
  p_customs jsonb,
  p_line_qty numeric,
  p_totals jsonb,
  p_quote_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_custom jsonb;
  v_type public.customization_types;
  v_qc public.quote_item_customizations;
  v_qty numeric;
  v_charged boolean;
  v_unit numeric;
  v_percent numeric;
  v_total numeric;
  v_custom_id uuid;
  v_name jsonb;
  v_ord integer;
begin
  for v_custom in select * from jsonb_array_elements(coalesce(p_customs, '[]')) loop
    select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
    v_qty := coalesce((v_custom ->> 'quantity')::numeric, p_line_qty);
    if p_quote_id is not null then
      select * into v_qc from public.quote_item_customizations qc
      where qc.id = (v_custom ->> 'quote_customization_id')::uuid
        and qc.quote_item_id in (select id from public.quote_items where quote_id = p_quote_id);
      if not found then
        raise exception 'Una personalización no corresponde al presupuesto.';
      end if;
      v_charged := v_qc.charged;
      v_unit := v_qc.unit_price_usd;
      v_percent := v_qc.discount_percent;
      v_total := v_qc.line_total_usd;
    else
      v_charged := coalesce((v_custom ->> 'charged')::boolean, true);
      if v_charged then
        v_unit := v_type.unit_price_usd;
        v_percent := public.volume_discount_percent('customization', (p_totals ->> v_type.id::text)::numeric);
        v_total := round(v_qty * v_unit * (1 - v_percent / 100), 2);
      else
        v_unit := 0;
        v_percent := 0;
        v_total := 0;
      end if;
    end if;

    insert into public.sale_item_customizations
      (sale_item_id, customization_type_id, quantity, text, logo_path, position, size_cm, note,
       charged, unit_price_usd, discount_percent, line_total_usd)
    values (
      p_item_id, v_type.id, v_qty,
      nullif(trim(v_custom ->> 'text'), ''), nullif(v_custom ->> 'logo_path', ''),
      nullif(trim(v_custom ->> 'position'), ''), (v_custom ->> 'size_cm')::numeric, nullif(trim(v_custom ->> 'note'), ''),
      v_charged, v_unit, v_percent, v_total
    )
    returning id into v_custom_id;
    v_ord := 0;
    for v_name in select * from jsonb_array_elements(coalesce(v_custom -> 'names', '[]')) loop
      v_ord := v_ord + 1;
      insert into public.sale_item_customization_names (customization_id, ordinal, name)
      values (v_custom_id, v_ord, trim(v_name #>> '{}'));
    end loop;
  end loop;
end;
$$;

-- La de todas las líneas y sus piezas. p_ids: las líneas creadas, en el orden de p_items.
create or replace function public.sale_customizations_save(p_items jsonb, p_ids jsonb, p_totals jsonb, p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_component record;
  v_parent uuid;
  v_children jsonb;
begin
  for v_row in select value as item, ordinality - 1 as idx from jsonb_array_elements(p_items) with ordinality loop
    v_parent := (p_ids ->> v_row.idx::int)::uuid;
    perform public.sale_customizations_line(
      v_parent, v_row.item -> 'customizations', (v_row.item ->> 'quantity')::numeric, p_totals, p_quote_id
    );
    if exists (
      select 1 from jsonb_array_elements(coalesce(v_row.item -> 'components', '[]')) c
      where jsonb_array_length(coalesce(c -> 'customizations', '[]')) > 0
    ) then
      v_children := public.combo_child_ids(v_parent, v_row.item -> 'components');
      for v_component in
        select value as comp, ordinality - 1 as idx from jsonb_array_elements(v_row.item -> 'components') with ordinality
      loop
        perform public.sale_customizations_line(
          (v_children ->> v_component.idx::int)::uuid, v_component.comp -> 'customizations',
          (v_component.comp ->> 'quantity')::numeric, p_totals, p_quote_id
        );
      end loop;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- Ventas: validar y cobrar (también las piezas de los combos)
-- ============================================================

-- Devuelve {"totals": {"<tipo>": piezas cobradas}, "extra": total cobrado en USD}.
create or replace function public.sale_customizations_check(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_component jsonb;
  v_custom jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_type public.customization_types;
  v_qty numeric;
  v_totals jsonb := '{}';
  v_extra numeric := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    select * into v_product from public.products where id = v_variant.product_id;
    if v_product.kind = 'combo' and jsonb_array_length(coalesce(v_item -> 'customizations', '[]')) > 0 then
      raise exception 'La personalización de un combo va en cada una de sus piezas.';
    end if;

    for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
      v_qty := public.sale_customization_qty(v_custom, (v_item ->> 'quantity')::numeric);
      if coalesce((v_custom ->> 'charged')::boolean, true) then
        v_totals := v_totals || jsonb_build_object(v_custom ->> 'type_id', coalesce((v_totals ->> (v_custom ->> 'type_id'))::numeric, 0) + v_qty);
      end if;
    end loop;
    for v_component in select * from jsonb_array_elements(coalesce(v_item -> 'components', '[]')) loop
      for v_custom in select * from jsonb_array_elements(coalesce(v_component -> 'customizations', '[]')) loop
        v_qty := public.sale_customization_qty(v_custom, (v_component ->> 'quantity')::numeric);
        if coalesce((v_custom ->> 'charged')::boolean, true) then
          v_totals := v_totals || jsonb_build_object(v_custom ->> 'type_id', coalesce((v_totals ->> (v_custom ->> 'type_id'))::numeric, 0) + v_qty);
        end if;
      end loop;
    end loop;
  end loop;

  -- Lo cobrado, por tipo, con su descuento al mayor.
  for v_type in select * from public.customization_types where v_totals ? id::text loop
    v_qty := (v_totals ->> v_type.id::text)::numeric;
    v_extra := v_extra + round(v_qty * v_type.unit_price_usd * (1 - public.volume_discount_percent('customization', v_qty) / 100), 2);
  end loop;

  return jsonb_build_object('totals', v_totals, 'extra', v_extra);
end;
$$;

create or replace function public.sale_customizations_insert(p_items jsonb, p_ids jsonb, p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sale_customizations_save(p_items, p_ids, p_totals, null);
end;
$$;

-- ============================================================
-- Pedidos
-- ============================================================

create or replace function public.create_order_engine(
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
  -- Solo al convertir un presupuesto: {"id", "currency"}. Nulo en pedidos normales.
  p_quote jsonb default null
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
  -- Todas las piezas personalizadas por tipo (cobradas o incluidas): para el mínimo por pedido.
  v_all_totals jsonb := '{}';
  v_comp_custom jsonb;
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
  v_quote public.quotes;
  v_quote_mode boolean := p_quote is not null;
  v_ves boolean := p_quote ->> 'currency' = 'ves';
  v_qi public.quote_items;
  v_qc public.quote_item_customizations;
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

  if v_quote_mode then
    select * into v_quote from public.quotes where id = (p_quote ->> 'id')::uuid;
    if not found then
      raise exception 'El presupuesto no existe.';
    end if;
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
        raise exception 'La personalización de un combo va en cada una de sus piezas.';
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
          v_components := v_components || (jsonb_build_object(
            'variant_id', v_c_variant.id, 'quantity', v_c_qty, 'source', v_c_source,
            'reserved_quantity', case when v_c_source = 'made_to_order' then v_c_reserve else 0 end
          ) || case when v_quote_mode then jsonb_strip_nulls(jsonb_build_object(
            'price', v_component -> 'price', 'line_total', v_component -> 'line_total'
          )) else '{}'::jsonb end);
        end;
      end loop;
      -- Personalización de cada pieza del combo (hasta las piezas de ese componente).
      for v_component in select * from jsonb_array_elements(coalesce(v_item -> 'components', '[]')) loop
        for v_comp_custom in select * from jsonb_array_elements(coalesce(v_component -> 'customizations', '[]')) loop
          v_custom_qty := public.order_customization_qty(v_comp_custom, (v_component ->> 'quantity')::numeric, v_quote_mode);
          v_all_totals := v_all_totals || jsonb_build_object(v_comp_custom ->> 'type_id',
            coalesce((v_all_totals ->> (v_comp_custom ->> 'type_id'))::numeric, 0) + v_custom_qty);
          if coalesce((v_comp_custom ->> 'charged')::boolean, true) then
            v_type_totals := v_type_totals || jsonb_build_object(v_comp_custom ->> 'type_id',
              coalesce((v_type_totals ->> (v_comp_custom ->> 'type_id'))::numeric, 0) + v_custom_qty);
          end if;
        end loop;
      end loop;
      v_items := v_items || (jsonb_build_object('variant_id', v_variant.id, 'quantity', v_item -> 'quantity', 'components', v_components) || case when v_quote_mode then (
            select jsonb_build_object(
              'price', case when v_ves then qi.ves_unit_price else qi.usd_unit_price end,
              'line_total', case when v_ves then qi.ves_line_total else qi.usd_line_total end
            ) from public.quote_items qi
            where qi.id = (v_item ->> 'quote_item_id')::uuid and qi.quote_id = v_quote.id and qi.parent_item_id is null
          ) else '{}'::jsonb end);
    else
      v_qty := (v_item ->> 'quantity')::numeric;
      select coalesce(sum(quantity), 0) - coalesce((v_used ->> v_variant.id::text)::numeric, 0) into v_reserve
      from public.stock_movements where variant_id = v_variant.id;
      if v_product.fulfillment_type = 'stock' then
        if p_stock_mode = 'produce_all' then
          raise exception '"%" solo se vende de inventario: usa "reservar y producir lo que falta".', v_product.name;
        end if;
        v_used := v_used || jsonb_build_object(v_variant.id::text, coalesce((v_used ->> v_variant.id::text)::numeric, 0) + v_qty);
        v_items := v_items || (jsonb_build_object('variant_id', v_variant.id, 'quantity', v_qty, 'source', 'stock') || case when v_quote_mode then (
            select jsonb_build_object(
              'price', case when v_ves then qi.ves_unit_price else qi.usd_unit_price end,
              'line_total', case when v_ves then qi.ves_line_total else qi.usd_line_total end
            ) from public.quote_items qi
            where qi.id = (v_item ->> 'quote_item_id')::uuid and qi.quote_id = v_quote.id and qi.parent_item_id is null
          ) else '{}'::jsonb end);
      else
        v_reserve := case when p_stock_mode = 'reserve_and_produce' and v_product.fulfillment_type = 'both'
                          then least(v_qty, greatest(v_reserve, 0)) else 0 end;
        v_used := v_used || jsonb_build_object(v_variant.id::text, coalesce((v_used ->> v_variant.id::text)::numeric, 0) + v_reserve);
        v_items := v_items || (jsonb_build_object(
          'variant_id', v_variant.id, 'quantity', v_qty, 'source', 'made_to_order', 'reserved_quantity', v_reserve
        ) || case when v_quote_mode then (
            select jsonb_build_object(
              'price', case when v_ves then qi.ves_unit_price else qi.usd_unit_price end,
              'line_total', case when v_ves then qi.ves_line_total else qi.usd_line_total end
            ) from public.quote_items qi
            where qi.id = (v_item ->> 'quote_item_id')::uuid and qi.quote_id = v_quote.id and qi.parent_item_id is null
          ) else '{}'::jsonb end);
      end if;

      -- Personalización: tipo activo, medida y datos completos; con precio si se cobra.
      for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
        v_custom_qty := public.order_customization_qty(v_custom, v_qty, v_quote_mode);
        v_all_totals := v_all_totals || jsonb_build_object(v_custom ->> 'type_id',
          coalesce((v_all_totals ->> (v_custom ->> 'type_id'))::numeric, 0) + v_custom_qty);
        if coalesce((v_custom ->> 'charged')::boolean, true) then
          v_type_totals := v_type_totals || jsonb_build_object(v_custom ->> 'type_id',
            coalesce((v_type_totals ->> (v_custom ->> 'type_id'))::numeric, 0) + v_custom_qty);
        end if;
      end loop;
    end if;
  end loop;

  -- 2. Mínimos por tipo y total de personalización (con su descuento al mayor por tipo).
  -- El mínimo cuenta todas las piezas; el precio, solo las cobradas.
  for v_type in select * from public.customization_types where v_all_totals ? id::text loop
    v_custom_qty := (v_all_totals ->> v_type.id::text)::numeric;
    if v_custom_qty < v_type.min_quantity then
      raise exception '"%" es desde % piezas por pedido (van %).', v_type.name, v_type.min_quantity, trim_scale(v_custom_qty);
    end if;
  end loop;
  for v_type in select * from public.customization_types where v_type_totals ? id::text loop
    v_custom_qty := (v_type_totals ->> v_type.id::text)::numeric;
    v_percent := public.volume_discount_percent('customization', v_custom_qty);
    if not v_quote_mode then
      v_extra := v_extra + round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2);
    end if;
  end loop;

  -- 3. La venta (sin pagos todavía: el abono se calcula con el total final).
  -- Desde un presupuesto: la personalización vale lo que dice el presupuesto.
  if v_quote_mode then
    v_extra := v_quote.customization_total_usd;
  end if;
  v_sale_id := public.create_sale_engine(
    p_channel, p_price_method_id, p_delivery_method, v_items, '[]', p_customer_id,
    p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, false,
    p_occurred_at, v_extra, true, p_vat_percent,
    case when v_quote_mode then jsonb_build_object('volume_percent', v_quote.volume_discount_percent) end
  );
  v_ids := current_setting('app.last_sale_item_ids', true)::jsonb;

  -- 4. Personalización de cada línea y de cada pieza de los combos.
  perform public.sale_customizations_save(p_items, v_ids, v_type_totals, case when v_quote_mode then v_quote.id end);

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

-- ============================================================
-- Presupuestos
-- ============================================================

-- Valida y guarda una personalización (precio provisional: el descuento por tipo va después).
-- Devuelve {"type_id", "quantity", "charged"}.
create or replace function public.quote_customization_add(p_item_id uuid, p_custom jsonb, p_line_qty numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.customization_types;
  v_qty numeric;
  v_charged boolean := coalesce((p_custom ->> 'charged')::boolean, true);
begin
  select * into v_type from public.customization_types where id = (p_custom ->> 'type_id')::uuid;
  if not found or not v_type.is_active then
    raise exception 'Una personalización no existe o está inactiva.';
  end if;
  if v_charged and v_type.unit_price_usd is null then
    raise exception '"%" todavía no tiene precio: anótala como incluida u owner o admin debe cargarlo en Configuración.', v_type.name;
  end if;
  v_qty := coalesce(nullif(p_custom ->> 'quantity', '')::numeric, p_line_qty);
  if v_qty <= 0 or v_qty > p_line_qty then
    raise exception '"%": la cantidad debe estar entre 1 y las piezas de la línea.', v_type.name;
  end if;
  if v_type.max_size_cm is not null and nullif(p_custom ->> 'size_cm', '')::numeric > v_type.max_size_cm then
    raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
  end if;
  insert into public.quote_item_customizations (
    quote_item_id, customization_type_id, type_name, quantity, size_cm, position, text, note, charged, unit_price_usd, line_total_usd
  )
  values (
    p_item_id, v_type.id, v_type.name, v_qty, nullif(p_custom ->> 'size_cm', '')::numeric,
    nullif(trim(p_custom ->> 'position'), ''), nullif(trim(p_custom ->> 'text'), ''), nullif(trim(p_custom ->> 'note'), ''),
    v_charged,
    case when v_charged then v_type.unit_price_usd else 0 end,
    case when v_charged then round(v_qty * v_type.unit_price_usd, 2) else 0 end
  );
  return jsonb_build_object('type_id', v_type.id, 'quantity', v_qty, 'charged', v_charged);
end;
$$;

create or replace function public.quote_apply_base(p_quote_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_is_management boolean := public.has_role(array['owner', 'admin']::public.app_role[]);
  v_max_percent numeric;
  v_customer public.customers;
  v_currencies public.quote_currencies := coalesce(p_payload ->> 'currencies', 'usd')::public.quote_currencies;
  v_use_usd boolean;
  v_use_ves boolean;
  v_usd_method public.payment_methods;
  v_ves_method public.payment_methods;
  v_rate public.exchange_rates;
  v_ves_rate numeric;
  v_valid_until date;
  v_settings public.quote_settings;
  v_item jsonb;
  v_component jsonb;
  v_custom jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_qty numeric;
  v_line_discount numeric;
  v_usd_price numeric;
  v_ves_price numeric;
  v_position integer := 0;
  v_item_id uuid;
  v_pieces numeric := 0;
  v_usd_products numeric := 0;
  v_ves_products numeric := 0;
  v_usd_line_disc numeric := 0;
  v_ves_line_disc numeric := 0;
  v_type public.customization_types;
  -- Todas las piezas personalizadas por tipo (para el mínimo) y lo que devuelve cada una.
  v_all_totals jsonb := '{}';
  v_added jsonb;
  v_comp_custom jsonb;
  v_type_totals jsonb := '{}';
  v_custom_qty numeric;
  v_custom_total numeric := 0;
  v_percent numeric;
  v_volume_percent numeric;
  v_def record;
  v_given numeric;
  v_discount_type public.discount_type := nullif(p_payload ->> 'discount_type', '')::public.discount_type;
  v_discount_value numeric := nullif(p_payload ->> 'discount_value', '')::numeric;
  v_discount_reason text := nullif(trim(p_payload ->> 'discount_reason'), '');
  v_usd jsonb;
  v_ves jsonb;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.status <> 'draft' then
    raise exception 'El presupuesto % ya no es un borrador: para cambiarlo crea una versión nueva.', v_quote.code;
  end if;
  select * into v_settings from public.quote_settings;
  select staff_max_discount_percent into v_max_percent from public.sales_settings;

  -- Cliente: el enlazado manda (con sus datos actuales); si no, basta con un nombre.
  if nullif(p_payload ->> 'customer_id', '') is not null then
    select * into v_customer from public.customers where id = (p_payload ->> 'customer_id')::uuid;
    if not found or not v_customer.is_active then
      raise exception 'El cliente no existe o está inactivo.';
    end if;
    if v_customer.blocked_at is not null then
      raise exception 'Cliente bloqueado: no puede recibir presupuestos. Motivo: %', coalesce(v_customer.blocked_reason, '—');
    end if;
    update public.quotes set
      customer_id = v_customer.id,
      customer_kind = v_customer.kind,
      customer_name = left(trim(concat_ws(' ', v_customer.first_name, v_customer.last_name)), 150),
      customer_legal_name = v_customer.legal_name,
      customer_tax_id = v_customer.tax_id,
      customer_phone = v_customer.phone,
      customer_email = v_customer.email,
      customer_address = v_customer.address,
      customer_contact_person = v_customer.contact_person
    where id = p_quote_id;
  else
    if coalesce(trim(p_payload #>> '{customer,name}'), '') = '' then
      raise exception 'Escribe el nombre del cliente.';
    end if;
    update public.quotes set
      customer_id = null,
      customer_kind = coalesce(nullif(p_payload #>> '{customer,kind}', ''), 'person')::public.customer_kind,
      customer_name = left(trim(p_payload #>> '{customer,name}'), 150),
      customer_legal_name = nullif(trim(p_payload #>> '{customer,legal_name}'), ''),
      customer_tax_id = nullif(trim(p_payload #>> '{customer,tax_id}'), ''),
      customer_phone = nullif(trim(p_payload #>> '{customer,phone}'), ''),
      customer_email = nullif(trim(p_payload #>> '{customer,email}'), ''),
      customer_address = nullif(trim(p_payload #>> '{customer,address}'), ''),
      customer_contact_person = nullif(trim(p_payload #>> '{customer,contact_person}'), '')
    where id = p_quote_id;
  end if;

  -- Listas de precios de las monedas que se muestran.
  v_use_usd := v_currencies in ('usd', 'both');
  v_use_ves := v_currencies in ('ves', 'both');
  if v_use_usd then
    select * into v_usd_method from public.payment_methods where id = nullif(p_payload ->> 'usd_price_method_id', '')::uuid;
    if v_usd_method.id is null or not v_usd_method.is_active or v_usd_method.rate_kind <> 'none' then
      raise exception 'Elige la lista de precios en USD (un método activo que cobra en divisas).';
    end if;
  end if;
  if v_use_ves then
    select * into v_ves_method from public.payment_methods where id = nullif(p_payload ->> 'ves_price_method_id', '')::uuid;
    if v_ves_method.id is null or not v_ves_method.is_active or v_ves_method.rate_kind = 'none' then
      raise exception 'Elige la lista de precios en Bs (un método activo que cobra en Bs).';
    end if;
    -- La tasa de hoy (la fecha del presupuesto se actualiza al guardar el borrador).
    v_rate := public.require_exchange_rate_for_date(public.caracas_today());
    -- Cliente que paga sus Bs a tasa euro (su acuerdo): el presupuesto en Bs también.
    v_ves_rate := case
      when v_ves_method.rate_kind = 'bcv_eur'
        or public.customer_ves_rate_kind(nullif(p_payload ->> 'customer_id', '')::uuid) = 'bcv_eur' then v_rate.bcv_eur
      else v_rate.bcv_usd
    end;
  else
    v_rate := public.exchange_rate_for_date(public.caracas_today());
  end if;

  v_valid_until := coalesce(nullif(p_payload ->> 'valid_until', '')::date, public.caracas_today() + v_settings.validity_days);
  if v_valid_until < public.caracas_today() then
    raise exception 'La fecha de vencimiento no puede ser pasada.';
  end if;

  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

  delete from public.quote_items where quote_id = p_quote_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
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

    v_line_discount := coalesce(nullif(v_item ->> 'discount_percent', '')::numeric, 0);
    if v_line_discount < 0 or v_line_discount > 100 then
      raise exception 'Descuento inválido en "%".', v_product.name;
    end if;
    if v_line_discount > 0 and not v_is_management and v_line_discount > v_max_percent + 0.0001 then
      raise exception '%', format('El descuento máximo sin owner o admin es %s%% ("%s").', trim_scale(v_max_percent), v_product.name);
    end if;
    if v_line_discount > 0 and v_discount_reason is null then
      raise exception 'Indica el motivo del descuento.';
    end if;

    v_usd_price := 0;
    v_ves_price := 0;
    if v_use_usd then
      v_usd_price := public.variant_price_usd(v_variant.id, v_usd_method.id);
      if v_usd_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_usd_method.name;
      end if;
    end if;
    if v_use_ves then
      v_ves_price := public.variant_price_usd(v_variant.id, v_ves_method.id);
      if v_ves_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_ves_method.name;
      end if;
    end if;

    if v_product.kind = 'combo' and v_qty <> trunc(v_qty) then
      raise exception 'Los combos van por unidades enteras.';
    end if;

    insert into public.quote_items (
      quote_id, position, kind, variant_id, product_name, sku, gender, color_name, size_name, size_sort, quantity,
      discount_percent, usd_unit_price, ves_unit_price, usd_line_total, ves_line_total
    )
    select
      p_quote_id, v_position, case when v_product.kind = 'combo' then 'combo' else 'product' end::public.quote_item_kind,
      v_variant.id, v_product.name, v_variant.sku, v_variant.gender, c.name, s.name, s.sort_order, v_qty,
      v_line_discount, coalesce(v_usd_price, 0), coalesce(v_ves_price, 0),
      round(coalesce(v_usd_price, 0) * v_qty * (1 - v_line_discount / 100), 2),
      round(coalesce(v_ves_price, 0) * v_qty * (1 - v_line_discount / 100), 2)
    from (select 1) x
    left join public.colors c on c.id = v_variant.color_id
    left join public.sizes s on s.id = v_variant.size_id
    returning id into v_item_id;
    v_position := v_position + 1;

    v_usd_products := v_usd_products + round(coalesce(v_usd_price, 0) * v_qty, 2);
    v_ves_products := v_ves_products + round(coalesce(v_ves_price, 0) * v_qty, 2);
    v_usd_line_disc := v_usd_line_disc + round(coalesce(v_usd_price, 0) * v_qty, 2) - round(coalesce(v_usd_price, 0) * v_qty * (1 - v_line_discount / 100), 2);
    v_ves_line_disc := v_ves_line_disc + round(coalesce(v_ves_price, 0) * v_qty, 2) - round(coalesce(v_ves_price, 0) * v_qty * (1 - v_line_discount / 100), 2);

    if v_product.kind = 'combo' then
      if jsonb_array_length(coalesce(v_item -> 'customizations', '[]')) > 0 then
        raise exception 'La personalización de un combo va en cada una de sus piezas.';
      end if;
      for v_component in select * from jsonb_array_elements(coalesce(v_item -> 'components', '[]')) loop
        declare
          v_c_variant public.product_variants;
          v_c_product public.products;
          v_c_qty numeric := (v_component ->> 'quantity')::numeric;
          v_c_slot uuid;
          v_c_price numeric;
          v_c_item_id uuid;
        begin
          if v_c_qty is null or v_c_qty <= 0 then
            raise exception 'Cantidad inválida en un componente de "%".', v_product.name;
          end if;
          select * into v_c_variant from public.product_variants where id = (v_component ->> 'variant_id')::uuid;
          select * into v_c_product from public.products where id = v_c_variant.product_id;
          select o.component_id into v_c_slot from public.combo_component_options o
          where o.combo_product_id = v_product.id and o.product_id = v_c_product.id;
          if v_c_product.id is null or v_c_slot is null then
            raise exception 'Un componente no es parte del combo "%".', v_product.name;
          end if;
          if not v_c_product.is_active or not v_c_variant.is_active then
            raise exception '"%" (%) está inactivo.', v_c_product.name, v_c_variant.sku;
          end if;
          -- Recargo de la talla y el color de la pieza, encima del precio del combo (en cada lista), con
          -- el descuento de la línea del combo.
          v_c_price := public.variant_surcharge_usd(v_c_variant.id);
          insert into public.quote_items (
            quote_id, parent_item_id, position, kind, variant_id, product_name, sku, gender, color_name, size_name, size_sort, quantity,
            discount_percent, usd_unit_price, ves_unit_price, usd_line_total, ves_line_total
          )
          select p_quote_id, v_item_id, v_position, 'component', v_c_variant.id, v_c_product.name, v_c_variant.sku, v_c_variant.gender, c.name, s.name, s.sort_order, v_c_qty,
            v_line_discount,
            case when v_use_usd then v_c_price else 0 end,
            case when v_use_ves then v_c_price else 0 end,
            case when v_use_usd then round(v_c_price * v_c_qty * (1 - v_line_discount / 100), 2) else 0 end,
            case when v_use_ves then round(v_c_price * v_c_qty * (1 - v_line_discount / 100), 2) else 0 end
          from (select 1) x
          left join public.colors c on c.id = v_c_variant.color_id
          left join public.sizes s on s.id = v_c_variant.size_id
          returning id into v_c_item_id;
          v_position := v_position + 1;
          -- Personalización de la pieza (hasta sus piezas).
          for v_comp_custom in select * from jsonb_array_elements(coalesce(v_component -> 'customizations', '[]')) loop
            v_added := public.quote_customization_add(v_c_item_id, v_comp_custom, v_c_qty);
            v_all_totals := v_all_totals || jsonb_build_object(v_added ->> 'type_id',
              coalesce((v_all_totals ->> (v_added ->> 'type_id'))::numeric, 0) + (v_added ->> 'quantity')::numeric);
            if (v_added ->> 'charged')::boolean then
              v_type_totals := v_type_totals || jsonb_build_object(v_added ->> 'type_id',
                coalesce((v_type_totals ->> (v_added ->> 'type_id'))::numeric, 0) + (v_added ->> 'quantity')::numeric);
            end if;
          end loop;
          v_pieces := v_pieces + v_c_qty;
          if v_use_usd then
            v_usd_products := v_usd_products + round(v_c_price * v_c_qty, 2);
            v_usd_line_disc := v_usd_line_disc + round(v_c_price * v_c_qty, 2) - round(v_c_price * v_c_qty * (1 - v_line_discount / 100), 2);
          end if;
          if v_use_ves then
            v_ves_products := v_ves_products + round(v_c_price * v_c_qty, 2);
            v_ves_line_disc := v_ves_line_disc + round(v_c_price * v_c_qty, 2) - round(v_c_price * v_c_qty * (1 - v_line_discount / 100), 2);
          end if;
        end;
      end loop;
      -- Cada combo lleva exactamente sus piezas.
      for v_def in select * from public.combo_slots(v_product.id) loop
        select coalesce(sum(qi.quantity), 0) into v_given
        from public.quote_items qi
        join public.product_variants pv on pv.id = qi.variant_id
        join public.combo_component_options o on o.product_id = pv.product_id and o.component_id = v_def.id
        where qi.parent_item_id = v_item_id;
        if v_given <> v_def.quantity * v_qty then
          raise exception 'El combo "%" lleva % de "%": elegiste %.', v_product.name, trim_scale(v_def.quantity * v_qty), v_def.name, trim_scale(v_given);
        end if;
      end loop;
    else
      v_pieces := v_pieces + v_qty;
      for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
        v_added := public.quote_customization_add(v_item_id, v_custom, v_qty);
        v_all_totals := v_all_totals || jsonb_build_object(v_added ->> 'type_id',
          coalesce((v_all_totals ->> (v_added ->> 'type_id'))::numeric, 0) + (v_added ->> 'quantity')::numeric);
        if (v_added ->> 'charged')::boolean then
          v_type_totals := v_type_totals || jsonb_build_object(v_added ->> 'type_id',
            coalesce((v_type_totals ->> (v_added ->> 'type_id'))::numeric, 0) + (v_added ->> 'quantity')::numeric);
        end if;
      end loop;
    end if;
  end loop;

  -- Personalización: mínimo por tipo y descuento al mayor por tipo (igual que en pedidos).
  -- El mínimo cuenta todas las piezas; el precio, solo las cobradas.
  for v_type in select * from public.customization_types where v_all_totals ? id::text loop
    v_custom_qty := (v_all_totals ->> v_type.id::text)::numeric;
    if v_custom_qty < v_type.min_quantity then
      raise exception '"%" es desde % piezas (van %).', v_type.name, v_type.min_quantity, trim_scale(v_custom_qty);
    end if;
  end loop;
  for v_type in select * from public.customization_types where v_type_totals ? id::text loop
    v_custom_qty := (v_type_totals ->> v_type.id::text)::numeric;
    v_percent := public.volume_discount_percent('customization', v_custom_qty);
    v_custom_total := v_custom_total + round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2);
    update public.quote_item_customizations qc
    set discount_percent = v_percent, line_total_usd = round(qc.quantity * qc.unit_price_usd * (1 - v_percent / 100), 2)
    from public.quote_items qi
    where qi.id = qc.quote_item_id and qi.quote_id = p_quote_id and qc.customization_type_id = v_type.id and qc.charged;
  end loop;

  -- Totales de cada lista.
  v_volume_percent := public.volume_discount_percent('products', v_pieces);
  if v_discount_type is not null and coalesce(v_discount_value, 0) > 0 and v_discount_reason is null then
    raise exception 'Indica el motivo del descuento.';
  end if;

  select jsonb_build_object('subtotal', t.subtotal, 'volume', t.volume, 'discount', t.discount, 'vat', t.vat) into v_usd
  from public.quote_totals(v_use_usd, v_usd_products, v_usd_line_disc, v_custom_total, v_volume_percent,
                           v_discount_type, v_discount_value, (p_payload ->> 'vat_enabled')::boolean, v_settings.vat_percent,
                           v_is_management, v_max_percent) t;
  select jsonb_build_object('subtotal', t.subtotal, 'volume', t.volume, 'discount', t.discount, 'vat', t.vat) into v_ves
  from public.quote_totals(v_use_ves, v_ves_products, v_ves_line_disc, v_custom_total, v_volume_percent,
                           v_discount_type, v_discount_value, (p_payload ->> 'vat_enabled')::boolean, v_settings.vat_percent,
                           v_is_management, v_max_percent) t;

  update public.quotes set
    issued_on = public.caracas_today(),
    valid_until = v_valid_until,
    currencies = v_currencies,
    usd_price_method_id = case when v_use_usd then v_usd_method.id end,
    ves_price_method_id = case when v_use_ves then v_ves_method.id end,
    bcv_usd_rate = v_rate.bcv_usd,
    bcv_eur_rate = v_rate.bcv_eur,
    ves_rate = v_ves_rate,
    vat_enabled = coalesce((p_payload ->> 'vat_enabled')::boolean, false),
    vat_percent = v_settings.vat_percent,
    igtf_note_enabled = coalesce((p_payload ->> 'igtf_note_enabled')::boolean, false),
    igtf_note = v_settings.igtf_note,
    discount_type = case when coalesce(v_discount_value, 0) > 0 then v_discount_type end,
    discount_value = case when coalesce(v_discount_value, 0) > 0 then v_discount_value end,
    discount_reason = case when coalesce(v_discount_value, 0) > 0 or v_usd_line_disc + v_ves_line_disc > 0 then v_discount_reason end,
    discount_by = case when coalesce(v_discount_value, 0) > 0 or v_usd_line_disc + v_ves_line_disc > 0 then auth.uid() end,
    group_by_size = coalesce((p_payload ->> 'group_by_size')::boolean, false),
    terms = nullif(trim(p_payload ->> 'terms'), ''),
    header_image_path = nullif(p_payload ->> 'header_image_path', ''),
    pieces = v_pieces,
    volume_discount_percent = case when v_volume_percent > 0 then v_volume_percent else 0 end,
    customization_total_usd = v_custom_total,
    usd_subtotal = (v_usd ->> 'subtotal')::numeric,
    usd_volume_discount = (v_usd ->> 'volume')::numeric,
    usd_line_discounts = case when v_use_usd then v_usd_line_disc else 0 end,
    usd_discount = (v_usd ->> 'discount')::numeric,
    usd_vat = (v_usd ->> 'vat')::numeric,
    usd_total = (v_usd ->> 'subtotal')::numeric - (v_usd ->> 'volume')::numeric - (v_usd ->> 'discount')::numeric + (v_usd ->> 'vat')::numeric,
    ves_subtotal = (v_ves ->> 'subtotal')::numeric,
    ves_volume_discount = (v_ves ->> 'volume')::numeric,
    ves_line_discounts = case when v_use_ves then v_ves_line_disc else 0 end,
    ves_discount = (v_ves ->> 'discount')::numeric,
    ves_vat = (v_ves ->> 'vat')::numeric,
    ves_total = (v_ves ->> 'subtotal')::numeric - (v_ves ->> 'volume')::numeric - (v_ves ->> 'discount')::numeric + (v_ves ->> 'vat')::numeric,
    ves_total_bs = case when v_use_ves then round(
      ((v_ves ->> 'subtotal')::numeric - (v_ves ->> 'volume')::numeric - (v_ves ->> 'discount')::numeric + (v_ves ->> 'vat')::numeric) * v_ves_rate, 2
    ) else 0 end
  where id = p_quote_id;
end;
$$;

-- La personalización de una línea o pieza del presupuesto, para copiarlo (duplicar o versionar).
create or replace function public.quote_customizations_copy(p_quote_item_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'type_id', qc.customization_type_id, 'quantity', qc.quantity, 'size_cm', qc.size_cm,
    'position', qc.position, 'text', qc.text, 'note', qc.note, 'charged', qc.charged
  )), '[]')
  from public.quote_item_customizations qc where qc.quote_item_id = p_quote_item_id;
$$;

create or replace function public.quote_payload(p_quote_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'customer_id', q.customer_id,
    'customer', jsonb_build_object(
      'kind', q.customer_kind, 'name', q.customer_name, 'legal_name', q.customer_legal_name, 'tax_id', q.customer_tax_id,
      'phone', q.customer_phone, 'email', q.customer_email, 'address', q.customer_address, 'contact_person', q.customer_contact_person
    ),
    'currencies', q.currencies,
    'usd_price_method_id', q.usd_price_method_id,
    'ves_price_method_id', q.ves_price_method_id,
    'vat_enabled', q.vat_enabled,
    'igtf_note_enabled', q.igtf_note_enabled,
    'discount_type', q.discount_type,
    'discount_value', q.discount_value,
    'discount_reason', q.discount_reason,
    'group_by_size', q.group_by_size,
    'terms', q.terms,
    'header_image_path', q.header_image_path,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_id', i.variant_id,
        'quantity', i.quantity,
        'discount_percent', i.discount_percent,
        'components', coalesce((
          select jsonb_agg(jsonb_build_object(
            'variant_id', c.variant_id, 'quantity', c.quantity, 'customizations', public.quote_customizations_copy(c.id)
          ) order by c.position)
          from public.quote_items c where c.parent_item_id = i.id
        ), '[]'),
        'customizations', public.quote_customizations_copy(i.id)
      ) order by i.position)
      from public.quote_items i where i.quote_id = q.id and i.parent_item_id is null
    ), '[]'),
    -- Las del catálogo cuya foto de origen se borró no se pueden copiar: se omiten.
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', im.source, 'product_image_id', im.product_image_id, 'path', im.path, 'label', im.label
      ) order by im.position)
      from public.quote_images im
      where im.quote_id = q.id and (im.source = 'upload' or im.product_image_id is not null)
    ), '[]')
  )
  from public.quotes q where q.id = p_quote_id;
$$;

-- La personalización de una línea o pieza del presupuesto, para el pedido (con lo que el pedido pide
-- y el presupuesto no: nombres, texto final y logo, en p_details por personalización).
create or replace function public.quote_customizations_for_order(p_quote_item_id uuid, p_details jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'quote_customization_id', qc.id,
    'type_id', qc.customization_type_id,
    'quantity', qc.quantity,
    'size_cm', qc.size_cm,
    'position', qc.position,
    'note', qc.note,
    'charged', qc.charged,
    'text', coalesce(nullif(trim(p_details #>> array[qc.id::text, 'text']), ''), qc.text),
    'names', coalesce(p_details -> qc.id::text -> 'names', '[]'),
    'logo_path', nullif(p_details #>> array[qc.id::text, 'logo_path'], '')
  )), '[]')
  from public.quote_item_customizations qc where qc.quote_item_id = p_quote_item_id;
$$;

create or replace function public.convert_quote_to_order(
  p_quote_id uuid,
  p_customer_id uuid,
  p_currency text,
  p_stock_mode public.order_stock_mode,
  p_promised_date date default null,
  p_channel public.sale_channel default 'whatsapp',
  p_delivery_method public.delivery_method default 'pickup',
  p_notes text default null,
  p_details jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_customer_id uuid;
  v_method uuid;
  v_items jsonb := '[]';
  v_item public.quote_items;
  v_sale_id uuid;
  v_sale public.sales;
  v_expected numeric;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar pedidos.' using errcode = '42501';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'El presupuesto no existe.';
  end if;
  if v_quote.order_sale_id is not null then
    select * into v_sale from public.sales where id = v_quote.order_sale_id;
    raise exception 'El presupuesto % ya se convirtió en el pedido NE-%.', v_quote.code, lpad(v_sale.number::text, 6, '0');
  end if;
  if v_quote.status <> 'accepted' or v_quote.superseded_by is not null then
    raise exception 'Solo un presupuesto aceptado se convierte en pedido (este está %).', v_quote.status;
  end if;

  v_customer_id := coalesce(v_quote.customer_id, p_customer_id);
  if v_customer_id is null then
    raise exception 'Elige o crea el cliente: un pedido necesita cliente.';
  end if;
  if v_quote.customer_id is not null and p_customer_id is not null and p_customer_id <> v_quote.customer_id then
    raise exception 'El presupuesto es de otro cliente.';
  end if;

  if p_currency not in ('usd', 'ves') then
    raise exception 'Elige la moneda: USD o Bs.';
  end if;
  if (p_currency = 'usd' and v_quote.currencies = 'ves') or (p_currency = 'ves' and v_quote.currencies = 'usd') then
    raise exception 'El presupuesto no tiene precios en %.', case p_currency when 'usd' then 'USD' else 'Bs' end;
  end if;
  v_method := case p_currency when 'usd' then v_quote.usd_price_method_id else v_quote.ves_price_method_id end;

  for v_item in
    select * from public.quote_items where quote_id = p_quote_id and parent_item_id is null order by position
  loop
    v_items := v_items || jsonb_build_object(
      'quote_item_id', v_item.id,
      'variant_id', v_item.variant_id,
      'quantity', v_item.quantity,
      'components', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'variant_id', c.variant_id, 'quantity', c.quantity,
          'price', case p_currency when 'usd' then c.usd_unit_price else c.ves_unit_price end,
          'line_total', case p_currency when 'usd' then c.usd_line_total else c.ves_line_total end,
          'customizations', public.quote_customizations_for_order(c.id, p_details)
        ) order by c.position), '[]')
        from public.quote_items c where c.parent_item_id = v_item.id
      ),
      'customizations', public.quote_customizations_for_order(v_item.id, p_details)
    );
  end loop;

  v_sale_id := public.create_order_engine(
    v_customer_id, v_method, p_channel, p_delivery_method, v_items, p_stock_mode, p_promised_date,
    '[]', 0, v_quote.discount_type, v_quote.discount_value, v_quote.discount_reason,
    coalesce(nullif(trim(p_notes), ''), 'Desde el presupuesto ' || v_quote.code), null,
    case when v_quote.vat_enabled then v_quote.vat_percent else 0 end,
    jsonb_build_object('id', p_quote_id, 'currency', p_currency)
  );

  -- El pedido cobra exactamente lo aceptado.
  select * into v_sale from public.sales where id = v_sale_id;
  v_expected := case p_currency when 'usd' then v_quote.usd_total else v_quote.ves_total end;
  if v_sale.total_usd <> v_expected then
    raise exception 'El total del pedido (%) no coincide con el del presupuesto (%). No se convirtió.', v_sale.total_usd, v_expected;
  end if;

  update public.quotes set order_sale_id = v_sale_id where id = p_quote_id;
  insert into public.quote_status_events (quote_id, status, note)
  values (p_quote_id, 'accepted', 'Convertido en el pedido NE-' || lpad(v_sale.number::text, 6, '0'));
  return v_sale_id;
end;
$$;

revoke all on function
  public.combo_child_ids(uuid, jsonb),
  public.sale_customization_qty(jsonb, numeric),
  public.order_customization_qty(jsonb, numeric, boolean),
  public.sale_customizations_line(uuid, jsonb, numeric, jsonb, uuid),
  public.sale_customizations_save(jsonb, jsonb, jsonb, uuid),
  public.quote_customization_add(uuid, jsonb, numeric),
  public.quote_customizations_copy(uuid),
  public.quote_customizations_for_order(uuid, jsonb)
from public, anon, authenticated;
