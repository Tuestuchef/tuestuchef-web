-- Presupuestos, paso 6: IVA en ventas y pedidos, y conversión de un presupuesto aceptado en pedido.
--
-- IVA (opción A): una venta o pedido puede llevar IVA sobre el total (después de descuentos, sin el
-- delivery), igual que en el presupuesto. Así el pedido convertido cobra exactamente lo aceptado.
-- El IVA cobrado NO es ingreso: en los resúmenes de utilidad (analytics_ledger_summary y
-- period_totals) la parte de IVA de cada cobro (y de sus reversos y reembolsos) sale de "ventas" y
-- se muestra aparte como 'vat_collected' ("IVA cobrado"), que no suma ni resta en la utilidad.
-- Lo relacionado con el SENIAT queda para después.
--
-- Conversión: convert_quote_to_order arma el pedido desde el presupuesto (cliente, líneas, combos,
-- personalización y precios del presupuesto, en la moneda elegida) y aplica la regla de abono.
-- Si el total no coincide con el del presupuesto, no se convierte. Se convierte una sola vez.
--
-- Las funciones de venta y pedido pasan a un "motor" interno con IVA y precios de presupuesto;
-- create_sale_core y create_order quedan como envoltorios con la misma firma (create_order suma
-- un IVA opcional al final).

-- ============================================================
-- IVA en ventas
-- ============================================================

alter table public.sales
  add column vat_percent numeric(5, 2) not null default 0 check (vat_percent >= 0 and vat_percent <= 100),
  add column vat_usd numeric(20, 2) not null default 0 check (vat_usd >= 0);

alter table public.sales drop constraint sales_total_consistent;
alter table public.sales
  add constraint sales_total_consistent
    check (total_usd = subtotal_usd - volume_discount_usd - discount_usd + delivery_fee_usd + vat_usd),
  add constraint sales_vat_consistent
    check (vat_usd = round((subtotal_usd - volume_discount_usd - discount_usd) * vat_percent / 100, 2));

-- El IVA cobrado es un tipo de los resúmenes, no una categoría para registrar.
alter table public.movement_categories
  add constraint movement_categories_not_vat check (type <> 'vat_collected');

-- Los reembolsos de pedidos quedan enlazados a su venta (para separar su parte de IVA).
-- cancel_order ya marca la venta que reembolsa en app.refunding_sale.
alter table public.ledger_entries add column sale_id uuid references public.sales (id);

create or replace function public.ledger_entries_link_refund()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entry_type = 'sale_refund' and new.sale_id is null then
    new.sale_id := nullif(current_setting('app.refunding_sale', true), '')::uuid;
  end if;
  return new;
end;
$$;

create trigger ledger_entries_link_refund before insert on public.ledger_entries
  for each row execute function public.ledger_entries_link_refund();

-- ============================================================
-- Motores de venta y pedido (copiados de 20261010010000_orders.sql, con IVA y precios de presupuesto)
-- ============================================================


create or replace function public.create_sale_engine(
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
  p_is_order boolean,
  -- IVA sobre el total (0 = sin IVA).
  p_vat_percent numeric,
  -- Solo al convertir un presupuesto: precios y totales de línea del presupuesto, su % al mayor
  -- y sin el límite de descuento de staff (ya se validó al hacerlo). Nulo en ventas y pedidos normales.
  p_quote_pricing jsonb
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
  v_quote_mode boolean := p_quote_pricing is not null;
  v_vat numeric := 0;
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

    if v_quote_mode then
      v_price := (v_item ->> 'price')::numeric;
      if v_price is null or v_price <= 0 then
        raise exception 'Falta el precio del presupuesto para "%".', v_product.name;
      end if;
    else
      select amount_usd into v_price
      from public.product_prices
      where product_id = v_product.id and payment_method_id = p_price_method_id;
      if v_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_method.name;
      end if;
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

      v_products_subtotal := v_products_subtotal + case when v_quote_mode then (v_item ->> 'line_total')::numeric else round(v_price * v_quantity, 2) end;
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
        'source', 'combo', 'reserved_quantity', 0, 'cost', null, 'children', v_children,
        'line_total', case when v_quote_mode then (v_item ->> 'line_total')::numeric end
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

      v_products_subtotal := v_products_subtotal + case when v_quote_mode then (v_item ->> 'line_total')::numeric else round(v_price * v_quantity, 2) end;
      v_pieces := v_pieces + v_quantity;
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
        'source', v_source, 'reserved_quantity', v_reserved, 'cost', v_variant.unit_cost_usdt,
        'line_total', case when v_quote_mode then (v_item ->> 'line_total')::numeric end
      );
    end if;
  end loop;

  -- Descuento al mayor de productos: sobre los productos, por piezas.
  v_volume_percent := case when v_quote_mode then coalesce((p_quote_pricing ->> 'volume_percent')::numeric, 0)
                           else public.volume_discount_percent('products', v_pieces) end;
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
    if not v_is_management and not v_quote_mode and v_discount_base > 0 then
      select staff_max_discount_percent into v_max_percent from public.sales_settings;
      if v_discount / v_discount_base * 100 > v_max_percent + 0.0001 then
        raise exception '%', format('El descuento máximo sin owner o admin es %s%%.', trim_scale(v_max_percent));
      end if;
    end if;
  end if;

  -- IVA sobre lo que queda después de descuentos (sin el delivery), como en los presupuestos.
  if coalesce(p_vat_percent, 0) < 0 or coalesce(p_vat_percent, 0) > 100 then
    raise exception 'IVA inválido.';
  end if;
  v_vat := round((v_subtotal - v_volume - v_discount) * coalesce(p_vat_percent, 0) / 100, 2);

  insert into public.sales (
    customer_id, channel, price_method_id, delivery_method,
    subtotal_usd, volume_discount_percent, volume_discount_usd,
    discount_type, discount_value, discount_usd, discount_reason, discount_by,
    delivery_fee_usd, vat_percent, vat_usd, total_usd, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate, notes,
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
    case when v_vat > 0 then p_vat_percent else 0 end,
    v_vat,
    v_subtotal - v_volume - v_discount + round(coalesce(p_delivery_fee_usd, 0), 2) + v_vat,
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
      coalesce((v_line ->> 'line_total')::numeric, round((v_line ->> 'price')::numeric * (v_line ->> 'quantity')::numeric, 2)),
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

      -- Personalización: tipo activo y con precio, medida y datos completos.
      for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
        select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
        if not found or not v_type.is_active then
          raise exception 'Una personalización no existe o está inactiva.';
        end if;
        if v_type.unit_price_usd is null and not v_quote_mode then
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

  -- 4. Personalización de cada línea.
  for v_item in select * from jsonb_array_elements(p_items) loop
    for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
      select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
      v_custom_qty := coalesce((v_custom ->> 'quantity')::numeric, (v_item ->> 'quantity')::numeric);
      v_percent := public.volume_discount_percent('customization', (v_type_totals ->> v_type.id::text)::numeric);
      if v_quote_mode then
        select * into v_qc from public.quote_item_customizations qc
        where qc.id = (v_custom ->> 'quote_customization_id')::uuid
          and qc.quote_item_id in (select id from public.quote_items where quote_id = v_quote.id);
        if not found then
          raise exception 'Una personalización no corresponde al presupuesto.';
        end if;
      end if;
      insert into public.sale_item_customizations
        (sale_item_id, customization_type_id, quantity, text, logo_path, position, size_cm, note,
         unit_price_usd, discount_percent, line_total_usd)
      values (
        (v_ids ->> v_index)::uuid, v_type.id, v_custom_qty,
        nullif(trim(v_custom ->> 'text'), ''), nullif(v_custom ->> 'logo_path', ''),
        nullif(trim(v_custom ->> 'position'), ''), (v_custom ->> 'size_cm')::numeric, nullif(trim(v_custom ->> 'note'), ''),
        case when v_quote_mode then v_qc.unit_price_usd else v_type.unit_price_usd end,
        case when v_quote_mode then v_qc.discount_percent else v_percent end,
        case when v_quote_mode then v_qc.line_total_usd else round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2) end
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



-- Envoltorios con la firma de siempre.
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
begin
  return public.create_sale_engine(
    p_channel, p_price_method_id, p_delivery_method, p_items, p_payments, p_customer_id,
    p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, p_delivered,
    p_occurred_at, p_extra_subtotal_usd, p_is_order, 0, null
  );
end;
$$;

drop function public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                                  jsonb, numeric, public.discount_type, numeric, text, text, timestamptz);

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
  p_occurred_at timestamptz default null,
  p_vat_percent numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.create_order_engine(
    p_customer_id, p_price_method_id, p_channel, p_delivery_method, p_items, p_stock_mode, p_promised_date,
    p_payments, p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, p_occurred_at,
    p_vat_percent, null
  );
end;
$$;

-- ============================================================
-- Conversión de un presupuesto en pedido
-- ============================================================

-- p_currency: con qué lista paga el cliente ('usd' o 'ves'). p_details: por personalización del
-- presupuesto ({ "<id>": { "text", "names": [...], "logo_path" } }), lo que el pedido necesita y el
-- presupuesto no pide (nombres, logo).
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
        select coalesce(jsonb_agg(jsonb_build_object('variant_id', c.variant_id, 'quantity', c.quantity) order by c.position), '[]')
        from public.quote_items c where c.parent_item_id = v_item.id
      ),
      'customizations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'quote_customization_id', qc.id,
          'type_id', qc.customization_type_id,
          'quantity', qc.quantity,
          'size_cm', qc.size_cm,
          'position', qc.position,
          'note', qc.note,
          'text', coalesce(nullif(trim(p_details #>> array[qc.id::text, 'text']), ''), qc.text),
          'names', coalesce(p_details -> qc.id::text -> 'names', '[]'),
          'logo_path', nullif(p_details #>> array[qc.id::text, 'logo_path'], '')
        )), '[]')
        from public.quote_item_customizations qc where qc.quote_item_id = v_item.id
      )
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

-- ============================================================
-- Utilidad: el IVA cobrado no es ingreso
-- ============================================================

-- Parte de IVA de un movimiento de cobro: el cobro de una venta, su reverso (anulación) o un
-- reembolso enlazado. 0 si no es de una venta con IVA.
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
      (select sp.sale_id from public.sale_payments sp where sp.ledger_entry_id = p_entry.id),
      (select sp.sale_id from public.sale_payments sp where sp.ledger_entry_id = p_entry.reverses_entry_id)
    )
  ), 0);
$$;

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
  with entries as (
    select
      to_char(l.occurred_at at time zone 'America/Caracas', 'YYYY-MM') as month,
      c.type,
      c.name,
      coalesce(t.full_name, p.full_name) as person,
      l.usdt_value,
      case when c.type = 'sales' then public.ledger_vat_ratio(l) else 0 end as vat_ratio
    from public.ledger_entries l
    join public.movement_categories c on c.id = l.category_id
    left join public.team_members t on t.id = l.team_member_id
    left join public.profiles p on p.id = l.person_id
    where l.occurred_at >= (p_from::timestamp at time zone 'America/Caracas')
      and l.occurred_at < ((p_to + 1)::timestamp at time zone 'America/Caracas')
  )
  select x.month, x.category_type, x.category_name, x.person_name, sum(x.value)
  from (
    select e.month, e.type as category_type, e.name as category_name, e.person as person_name, e.usdt_value * (1 - e.vat_ratio) as value
    from entries e
    union all
    select e.month, 'vat_collected'::public.category_type, 'IVA cobrado', null, e.usdt_value * e.vat_ratio
    from entries e where e.vat_ratio > 0
  ) x
  group by 1, 2, 3, 4
  order by 1, 2, 3;
$$;

create or replace function public.period_totals(p_period date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with entries as (
    select c.type, l.usdt_value, case when c.type = 'sales' then public.ledger_vat_ratio(l) else 0 end as vat_ratio
    from public.ledger_entries l
    join public.movement_categories c on c.id = l.category_id
    where l.occurred_at >= (p_period::timestamp at time zone 'America/Caracas')
      and l.occurred_at < ((p_period + interval '1 month')::timestamp at time zone 'America/Caracas')
  )
  select coalesce(jsonb_object_agg(category_type, total), '{}')
  from (
    select category_type, round(sum(value), 2) as total
    from (
      select e.type as category_type, e.usdt_value * (1 - e.vat_ratio) as value from entries e
      union all
      select 'vat_collected'::public.category_type, e.usdt_value * e.vat_ratio from entries e where e.vat_ratio > 0
    ) x
    group by category_type
  ) t;
$$;

-- ============================================================
-- Permisos
-- ============================================================

revoke all on function public.ledger_entries_link_refund() from public, anon, authenticated;
revoke all on function
  public.create_sale_engine(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
                            public.discount_type, numeric, text, text, boolean, timestamptz, numeric, boolean, numeric, jsonb),
  public.create_order_engine(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                             jsonb, numeric, public.discount_type, numeric, text, text, timestamptz, numeric, jsonb)
from public, anon, authenticated;
revoke all on function
  public.create_sale_core(public.sale_channel, uuid, public.delivery_method, jsonb, jsonb, uuid, numeric,
                          public.discount_type, numeric, text, text, boolean, timestamptz, numeric, boolean)
from public, anon, authenticated;

revoke all on function
  public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                      jsonb, numeric, public.discount_type, numeric, text, text, timestamptz, numeric)
from public, anon;
grant execute on function
  public.create_order(uuid, uuid, public.sale_channel, public.delivery_method, jsonb, public.order_stock_mode, date,
                      jsonb, numeric, public.discount_type, numeric, text, text, timestamptz, numeric)
to authenticated;

revoke all on function public.convert_quote_to_order(uuid, uuid, text, public.order_stock_mode, date, public.sale_channel,
                                                     public.delivery_method, text, jsonb) from public, anon;
grant execute on function public.convert_quote_to_order(uuid, uuid, text, public.order_stock_mode, date, public.sale_channel,
                                                        public.delivery_method, text, jsonb) to authenticated;
