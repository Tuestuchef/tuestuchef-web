-- Presupuestos: corrige qué método de pago sirve como lista de precios de cada moneda.
--
-- Los precios de todos los métodos se guardan en USD (regla 8), así que price_currency no
-- distingue nada. Lo que hace que un método cobre en bolívares es su cuenta en Bs, que obliga a
-- una tasa BCV (rate_kind dólar o euro). Por eso:
-- · Lista en Bs: un método con tasa BCV (cobra en Bs: pago móvil, transferencia).
-- · Lista en USD: un método sin tasa (cobra en divisas: efectivo, Zelle, USDT).
-- Se reemplazan las dos funciones que usaban price_currency; el resto queda igual.

create or replace function public.quote_settings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'El siguiente número solo puede aumentar (actual: %).', old.next_number using errcode = 'check_violation';
  end if;
  if new.default_usd_price_method_id is not null and not exists (
    select 1 from public.payment_methods where id = new.default_usd_price_method_id and rate_kind = 'none'
  ) then
    raise exception 'La lista en USD debe ser de un método que cobra en divisas (sin tasa BCV).' using errcode = 'check_violation';
  end if;
  if new.default_ves_price_method_id is not null and not exists (
    select 1 from public.payment_methods where id = new.default_ves_price_method_id and rate_kind <> 'none'
  ) then
    raise exception 'La lista en Bs debe ser de un método que cobra en Bs (con tasa BCV).' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


create or replace function public.quote_apply(p_quote_id uuid, p_payload jsonb)
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
    v_ves_rate := case v_ves_method.rate_kind when 'bcv_eur' then v_rate.bcv_eur else v_rate.bcv_usd end;
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
      select amount_usd into v_usd_price from public.product_prices where product_id = v_product.id and payment_method_id = v_usd_method.id;
      if v_usd_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_usd_method.name;
      end if;
    end if;
    if v_use_ves then
      select amount_usd into v_ves_price from public.product_prices where product_id = v_product.id and payment_method_id = v_ves_method.id;
      if v_ves_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_ves_method.name;
      end if;
    end if;

    if v_product.kind = 'combo' and v_qty <> trunc(v_qty) then
      raise exception 'Los combos van por unidades enteras.';
    end if;

    insert into public.quote_items (
      quote_id, position, kind, variant_id, product_name, sku, color_name, size_name, size_sort, quantity,
      discount_percent, usd_unit_price, ves_unit_price, usd_line_total, ves_line_total
    )
    select
      p_quote_id, v_position, case when v_product.kind = 'combo' then 'combo' else 'product' end::public.quote_item_kind,
      v_variant.id, v_product.name, v_variant.sku, c.name, s.name, s.sort_order, v_qty,
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
        raise exception 'La personalización va en productos sueltos, no en combos.';
      end if;
      for v_component in select * from jsonb_array_elements(coalesce(v_item -> 'components', '[]')) loop
        declare
          v_c_variant public.product_variants;
          v_c_product public.products;
          v_c_qty numeric := (v_component ->> 'quantity')::numeric;
        begin
          if v_c_qty is null or v_c_qty <= 0 then
            raise exception 'Cantidad inválida en un componente de "%".', v_product.name;
          end if;
          select * into v_c_variant from public.product_variants where id = (v_component ->> 'variant_id')::uuid;
          select * into v_c_product from public.products where id = v_c_variant.product_id;
          if v_c_product.id is null or not exists (
            select 1 from public.combo_components where combo_product_id = v_product.id and component_product_id = v_c_product.id
          ) then
            raise exception 'Un componente no es parte del combo "%".', v_product.name;
          end if;
          if not v_c_product.is_active or not v_c_variant.is_active then
            raise exception '"%" (%) está inactivo.', v_c_product.name, v_c_variant.sku;
          end if;
          insert into public.quote_items (quote_id, parent_item_id, position, kind, variant_id, product_name, sku, color_name, size_name, size_sort, quantity)
          select p_quote_id, v_item_id, v_position, 'component', v_c_variant.id, v_c_product.name, v_c_variant.sku, c.name, s.name, s.sort_order, v_c_qty
          from (select 1) x
          left join public.colors c on c.id = v_c_variant.color_id
          left join public.sizes s on s.id = v_c_variant.size_id;
          v_position := v_position + 1;
          v_pieces := v_pieces + v_c_qty;
        end;
      end loop;
      -- Cada combo lleva exactamente sus piezas.
      for v_def in
        select cc.component_product_id, cc.quantity, p.name
        from public.combo_components cc join public.products p on p.id = cc.component_product_id
        where cc.combo_product_id = v_product.id
      loop
        select coalesce(sum(qi.quantity), 0) into v_given
        from public.quote_items qi join public.product_variants pv on pv.id = qi.variant_id
        where qi.parent_item_id = v_item_id and pv.product_id = v_def.component_product_id;
        if v_given <> v_def.quantity * v_qty then
          raise exception 'El combo "%" lleva % de "%": elegiste %.', v_product.name, trim_scale(v_def.quantity * v_qty), v_def.name, trim_scale(v_given);
        end if;
      end loop;
    else
      v_pieces := v_pieces + v_qty;
      for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
        select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
        if not found or not v_type.is_active then
          raise exception 'Una personalización no existe o está inactiva.';
        end if;
        if v_type.unit_price_usd is null then
          raise exception '"%" todavía no tiene precio: owner o admin debe cargarlo en Configuración.', v_type.name;
        end if;
        v_custom_qty := coalesce(nullif(v_custom ->> 'quantity', '')::numeric, v_qty);
        if v_custom_qty <= 0 or v_custom_qty > v_qty then
          raise exception '"%": la cantidad debe estar entre 1 y las piezas de la línea.', v_type.name;
        end if;
        if v_type.max_size_cm is not null and nullif(v_custom ->> 'size_cm', '')::numeric > v_type.max_size_cm then
          raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
        end if;
        -- Precio provisional; el descuento al mayor por tipo se aplica abajo, con el total del tipo.
        insert into public.quote_item_customizations (
          quote_item_id, customization_type_id, type_name, quantity, size_cm, position, text, note, unit_price_usd, line_total_usd
        )
        values (
          v_item_id, v_type.id, v_type.name, v_custom_qty, nullif(v_custom ->> 'size_cm', '')::numeric,
          nullif(trim(v_custom ->> 'position'), ''), nullif(trim(v_custom ->> 'text'), ''), nullif(trim(v_custom ->> 'note'), ''),
          v_type.unit_price_usd, round(v_custom_qty * v_type.unit_price_usd, 2)
        );
        v_type_totals := v_type_totals || jsonb_build_object(v_type.id::text, coalesce((v_type_totals ->> v_type.id::text)::numeric, 0) + v_custom_qty);
      end loop;
    end if;
  end loop;

  -- Personalización: mínimo por tipo y descuento al mayor por tipo (igual que en pedidos).
  for v_type in select * from public.customization_types where v_type_totals ? id::text loop
    v_custom_qty := (v_type_totals ->> v_type.id::text)::numeric;
    if v_custom_qty < v_type.min_quantity then
      raise exception '"%" es desde % piezas (van %).', v_type.name, v_type.min_quantity, trim_scale(v_custom_qty);
    end if;
    v_percent := public.volume_discount_percent('customization', v_custom_qty);
    v_custom_total := v_custom_total + round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2);
    update public.quote_item_customizations qc
    set discount_percent = v_percent, line_total_usd = round(qc.quantity * qc.unit_price_usd * (1 - v_percent / 100), 2)
    from public.quote_items qi
    where qi.id = qc.quote_item_id and qi.quote_id = p_quote_id and qc.customization_type_id = v_type.id;
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

