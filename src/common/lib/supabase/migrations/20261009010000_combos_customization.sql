-- Fase 3, paso 1: combos, catálogo de personalización y descuento al mayor.
--
-- Combos
--   Un combo es un producto (kind = 'combo') con precio propio por método de pago y una sola
--   variante (la que se vende). Sus componentes se definen en combo_components. Al vender, la
--   línea del combo lleva el precio (source = 'combo', sin stock) y cada componente es una línea
--   hija (parent_item_id) con su talla y color, precio 0, que descuenta stock o va a producción.
--
-- Personalización
--   Catálogo de tipos (nombre bordado, logos) con precio en USD de referencia y mínimo. Las
--   líneas personalizadas se registran con los pedidos (paso 2).
--
-- Descuento al mayor
--   Tramos por cantidad de piezas, con alcance 'products' (todas las piezas de la venta) o
--   'customization' (piezas de cada tipo de personalización, paso 2). Se aplica solo, aparte
--   del descuento manual, y no cuenta para el límite de descuento de staff.

-- ============================================================
-- Combos
-- ============================================================

-- La variante única de un combo se crea sola. No lleva receta, stock ni más variantes.
create or replace function public.products_after_insert_combo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'combo' then
    perform set_config('app.creating_combo_variant', new.id::text, true);
    insert into public.product_variants (product_id, sku, created_by)
    values (new.id, 'CMB-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)), new.created_by);
    perform set_config('app.creating_combo_variant', '', true);
  end if;
  return new;
end;
$$;

create trigger products_after_insert_combo
after insert on public.products
for each row execute function public.products_after_insert_combo();

-- Un producto no cambia de tipo (terminado, materia prima o combo) después de creado.
create or replace function public.products_guard_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'El tipo de un producto no se cambia después de creado.';
  end if;
  return new;
end;
$$;

create trigger products_guard_kind
before update on public.products
for each row execute function public.products_guard_kind();

create or replace function public.product_variants_guard_combo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.products where id = new.product_id and kind = 'combo')
     and coalesce(current_setting('app.creating_combo_variant', true), '') <> new.product_id::text then
    raise exception 'Un combo tiene una sola variante: la talla y el color se eligen en cada componente al vender.';
  end if;
  return new;
end;
$$;

create trigger product_variants_guard_combo
before insert on public.product_variants
for each row execute function public.product_variants_guard_combo();

create or replace function public.stock_movements_block_combo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = new.variant_id and p.kind = 'combo'
  ) then
    raise exception 'Un combo no lleva stock: el stock es de cada componente.';
  end if;
  return new;
end;
$$;

create trigger stock_movements_block_combo
before insert on public.stock_movements
for each row execute function public.stock_movements_block_combo();

create table public.combo_components (
  id uuid primary key default gen_random_uuid(),
  combo_product_id uuid not null references public.products (id),
  component_product_id uuid not null references public.products (id),
  quantity integer not null default 1 check (quantity between 1 and 100),
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint combo_components_unique unique (combo_product_id, component_product_id),
  constraint combo_components_not_self check (combo_product_id <> component_product_id)
);

create index combo_components_combo_idx on public.combo_components (combo_product_id, sort_order);

create or replace function public.combo_components_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_combo public.product_kind;
  v_component public.product_kind;
begin
  select kind into v_combo from public.products where id = new.combo_product_id;
  select kind into v_component from public.products where id = new.component_product_id;
  if v_combo is distinct from 'combo' then
    raise exception 'Solo un combo lleva componentes.';
  end if;
  if v_component is distinct from 'finished_good' then
    raise exception 'Los componentes de un combo son productos terminados (no materia prima ni otro combo).';
  end if;
  return new;
end;
$$;

create trigger combo_components_validate
before insert or update on public.combo_components
for each row execute function public.combo_components_validate();

create trigger combo_components_created_audit before insert on public.combo_components
  for each row execute function public.set_created_audit();
create trigger combo_components_updated_audit before update on public.combo_components
  for each row execute function public.set_updated_audit();

-- ============================================================
-- Líneas de venta: combo y componentes
-- ============================================================

alter table public.sale_items add column parent_item_id uuid references public.sale_items (id);
create index sale_items_parent_idx on public.sale_items (parent_item_id) where parent_item_id is not null;

-- Las líneas hijas de un combo van a precio 0: el precio está en la línea del combo.
alter table public.sale_items drop constraint sale_items_unit_price_usd_check;
alter table public.sale_items add constraint sale_items_price_by_kind check (
  (parent_item_id is null and unit_price_usd > 0)
  or (parent_item_id is not null and source <> 'combo' and unit_price_usd = 0 and line_total_usd = 0)
);

-- Materia prima no se vende; un combo solo como línea de combo; un componente nunca es combo.
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
  if (v_product.kind = 'combo') <> (new.source = 'combo') then
    raise exception 'Línea de combo inválida para "%".', v_product.name;
  end if;
  if new.source = 'combo' and new.parent_item_id is not null then
    raise exception 'Un combo no puede ir dentro de otro combo.';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Descuento al mayor
-- ============================================================

create table public.volume_discount_tiers (
  id uuid primary key default gen_random_uuid(),
  scope public.volume_discount_scope not null,
  min_quantity integer not null check (min_quantity >= 2),
  percent numeric(5, 2) not null check (percent > 0 and percent <= 100),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint volume_discount_tiers_unique unique (scope, min_quantity)
);

create trigger volume_discount_tiers_created_audit before insert on public.volume_discount_tiers
  for each row execute function public.set_created_audit();
create trigger volume_discount_tiers_updated_audit before update on public.volume_discount_tiers
  for each row execute function public.set_updated_audit();

-- Porcentaje del tramo más alto alcanzado (0 si no alcanza ninguno).
create or replace function public.volume_discount_percent(p_scope public.volume_discount_scope, p_quantity numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select percent from public.volume_discount_tiers
     where scope = p_scope and min_quantity <= p_quantity
     order by min_quantity desc limit 1),
    0
  );
$$;

alter table public.sales
  add column volume_discount_percent numeric(5, 2) not null default 0
    check (volume_discount_percent >= 0 and volume_discount_percent <= 100),
  add column volume_discount_usd numeric(20, 2) not null default 0 check (volume_discount_usd >= 0);

alter table public.sales drop constraint sales_total_consistent;
alter table public.sales add constraint sales_total_consistent
  check (total_usd = subtotal_usd - volume_discount_usd - discount_usd + delivery_fee_usd);
alter table public.sales add constraint sales_volume_discount_consistent
  check ((volume_discount_usd = 0) = (volume_discount_percent = 0));

-- ============================================================
-- Catálogo de personalización
-- ============================================================

create table public.customization_types (
  id uuid primary key default gen_random_uuid(),
  -- Código estable (lo usa el sistema); el nombre se puede cambiar.
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 300),
  -- Precio por unidad en USD de referencia. Vacío: todavía no se puede usar.
  unit_price_usd numeric(20, 2) check (unit_price_usd is null or unit_price_usd > 0),
  -- Cantidad mínima de piezas con esta personalización en un pedido.
  min_quantity integer not null default 1 check (min_quantity between 1 and 1000),
  -- Medida máxima (cm). Lo que pase de aquí se trata como otro tipo (p. ej. logo de pecho).
  max_size_cm numeric(5, 1) check (max_size_cm is null or max_size_cm > 0),
  -- Medida de referencia para mostrar (p. ej. 15 cm el logo de pecho).
  default_size_cm numeric(5, 1) check (default_size_cm is null or default_size_cm > 0),
  requires_text boolean not null default false,
  requires_logo boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger customization_types_created_audit before insert on public.customization_types
  for each row execute function public.set_created_audit();
create trigger customization_types_updated_audit before update on public.customization_types
  for each row execute function public.set_updated_audit();

-- El código no cambia: el sistema lo usa para reconocer cada tipo.
create or replace function public.customization_types_guard_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'El código de una personalización no se cambia.';
  end if;
  return new;
end;
$$;

create trigger customization_types_guard_code
before update on public.customization_types
for each row execute function public.customization_types_guard_code();

-- Tipos iniciales. Los precios de logos quedan vacíos hasta confirmarlos.
insert into public.customization_types
  (code, name, description, unit_price_usd, min_quantity, max_size_cm, default_size_cm, requires_text, requires_logo, sort_order)
values
  ('embroidered_name', 'Nombre bordado', 'Nombre o texto bordado en la prenda.', 4, 1, null, null, true, false, 1),
  ('pocket_logo', 'Logo bordado de bolsillo', 'Logo bordado de hasta 8 cm. Más grande se considera logo de pecho.', null, 6, 8, 8, false, true, 2),
  ('printed_logo', 'Logo estampado', 'Logo estampado en la prenda.', null, 6, null, null, false, true, 3),
  ('chest_logo', 'Logo de pecho', 'Logo de más de 8 cm (aprox. 15 cm), centrado en el pecho.', null, 6, null, 15, false, true, 4);

-- ============================================================
-- Ventas: combos y descuento al mayor
-- ============================================================

-- Misma firma que antes. Cambios:
--   · Una línea puede ser un combo: {variant_id (del combo), quantity, components: [{variant_id, quantity, source}]}.
--     Los componentes deben sumar, por producto, cantidad del componente × cantidad del combo.
--   · Descuento al mayor automático por cantidad de piezas (los combos cuentan por sus componentes).
--   · El descuento manual se calcula sobre el subtotal menos el descuento al mayor.
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
declare
  v_is_management boolean := public.has_role(array['owner', 'admin']::public.app_role[]);
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_date date;
  v_is_backdated boolean;
  v_rate public.exchange_rates;
  v_method public.payment_methods;
  v_sale_id uuid;
  v_item jsonb;
  v_component jsonb;
  v_payment jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_source public.sale_line_source;
  v_quantity numeric;
  v_price numeric;
  v_subtotal numeric := 0;
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
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar ventas.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

  -- Fecha: nada futuro, límite para staff y, si es pasada, las tasas de esa fecha.
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

  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and is_active) then
    raise exception 'El cliente no existe o está inactivo.';
  end if;

  if coalesce(p_delivery_fee_usd, 0) < 0 then
    raise exception 'El delivery no puede ser negativo.';
  end if;

  -- Líneas: precio del método elegido; sin precio no se vende.
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

      -- Cada componente elegido debe pertenecer al combo.
      v_children := '[]';
      for v_component in select * from jsonb_array_elements(v_item -> 'components') loop
        declare
          v_c_variant public.product_variants;
          v_c_product public.products;
          v_c_quantity numeric := (v_component ->> 'quantity')::numeric;
          v_c_source public.sale_line_source := coalesce(v_component ->> 'source', 'stock')::public.sale_line_source;
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
          v_children := v_children || jsonb_build_object(
            'variant_id', v_c_variant.id, 'product_id', v_c_product.id, 'quantity', v_c_quantity,
            'source', v_c_source, 'cost', v_c_variant.unit_cost_usdt
          );
          v_pieces := v_pieces + v_c_quantity;
        end;
      end loop;

      -- Por producto: lo elegido debe sumar cantidad del componente × cantidad de combos.
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

      v_subtotal := v_subtotal + round(v_price * v_quantity, 2);
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
        'source', 'combo', 'cost', null, 'children', v_children
      );
    else
      v_source := coalesce(v_item ->> 'source', 'stock')::public.sale_line_source;
      if v_source = 'combo' then
        raise exception '"%" no es un combo.', v_product.name;
      end if;
      if v_product.fulfillment_type = 'stock' and v_source <> 'stock' then
        raise exception '"%" se vende solo de inventario.', v_product.name;
      end if;
      if v_product.fulfillment_type = 'made_to_order' and v_source <> 'made_to_order' then
        raise exception '"%" se vende solo por encargo.', v_product.name;
      end if;

      v_subtotal := v_subtotal + round(v_price * v_quantity, 2);
      v_pieces := v_pieces + v_quantity;
      v_lines := v_lines || jsonb_build_object(
        'variant_id', v_variant.id, 'quantity', v_quantity, 'price', v_price,
        'source', v_source, 'cost', v_variant.unit_cost_usdt
      );
    end if;
  end loop;

  -- Descuento al mayor: automático, por piezas.
  v_volume_percent := public.volume_discount_percent('products', v_pieces);
  v_volume := round(v_subtotal * v_volume_percent / 100, 2);

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
    insert into public.sale_items (sale_id, variant_id, quantity, unit_price_usd, line_total_usd, unit_cost_usdt, source)
    values (
      v_sale_id, (v_line ->> 'variant_id')::uuid, (v_line ->> 'quantity')::numeric, (v_line ->> 'price')::numeric,
      round((v_line ->> 'price')::numeric * (v_line ->> 'quantity')::numeric, 2),
      (v_line ->> 'cost')::numeric, (v_line ->> 'source')::public.sale_line_source
    )
    returning id into v_item_id;

    if v_line ->> 'source' = 'combo' then
      -- La línea del combo no tiene stock ni estado: los tienen sus componentes.
      v_parent_id := v_item_id;
      for v_child in select * from jsonb_array_elements(v_line -> 'children') loop
        insert into public.sale_items
          (sale_id, parent_item_id, variant_id, quantity, unit_price_usd, line_total_usd, unit_cost_usdt, source)
        values (
          v_sale_id, v_parent_id, (v_child ->> 'variant_id')::uuid, (v_child ->> 'quantity')::numeric, 0, 0,
          (v_child ->> 'cost')::numeric, (v_child ->> 'source')::public.sale_line_source
        )
        returning id into v_item_id;
        perform public.sale_line_after_insert(v_item_id, v_child, v_at, p_delivered);
      end loop;
    else
      perform public.sale_line_after_insert(v_item_id, v_line, v_at, p_delivered);
    end if;
  end loop;
  perform set_config('app.creating_sale', '', true);

  -- Pagos al registrar la venta: misma fecha que la venta.
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

-- Stock y estado inicial de una línea que tiene variante física (no la del combo). Interna.
create or replace function public.sale_line_after_insert(
  p_item_id uuid,
  p_line jsonb,
  p_occurred_at timestamptz,
  p_delivered boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_line ->> 'source' = 'stock' then
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id, occurred_at)
    values ((p_line ->> 'variant_id')::uuid, 'sale', -(p_line ->> 'quantity')::numeric, (p_line ->> 'cost')::numeric,
            p_item_id, p_occurred_at);
  end if;

  insert into public.sale_item_status_events (sale_item_id, status)
  values (
    p_item_id,
    case
      when p_line ->> 'source' = 'made_to_order' then 'to_produce'
      when p_delivered then 'delivered'
      else 'ready'
    end::public.sale_item_status
  );
end;
$$;

-- La línea de un combo no tiene estado propio: se avanza cada componente.
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
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_item from public.sale_items where id = p_sale_item_id;
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
  if v_current is not null and p_status <= v_current then
    raise exception 'El estado solo avanza (actual: %).', v_current;
  end if;

  if v_item.source = 'made_to_order' and p_status in ('ready', 'delivered') then
    perform public.consume_for_sale_item(p_sale_item_id);
  end if;

  insert into public.sale_item_status_events (sale_item_id, status, note)
  values (p_sale_item_id, p_status, nullif(trim(p_note), ''));
end;
$$;

-- ============================================================
-- Márgenes con combos
-- ============================================================

-- Margen por producto vendido. El ingreso de un combo se reparte entre sus componentes según
-- el precio de cada uno con el mismo método de pago (o por cantidad si no tienen precio), y
-- el ingreso cuenta después del descuento al mayor y del descuento manual.
create or replace function public.product_sales_margin(p_from date, p_to date)
returns table (
  product_id uuid,
  product_name text,
  units numeric,
  revenue_usd numeric,
  revenue_usdt numeric,
  material_cost_usdt numeric,
  labor_cost_usdt numeric,
  margin_usdt numeric,
  lines_without_cost integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sold as (
    select
      i.*,
      s.price_method_id,
      case when s.subtotal_usd > 0
           then (s.subtotal_usd - s.volume_discount_usd - s.discount_usd) / s.subtotal_usd
           else 0 end as net_factor,
      case pm.rate_kind
        when 'bcv_usd' then s.bcv_usd_rate / s.binance_rate
        when 'bcv_eur' then s.bcv_eur_rate / s.binance_rate
        else s.usd_usdt_rate
      end as real_factor
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    join public.payment_methods pm on pm.id = s.price_method_id
    where s.occurred_at >= (p_from::timestamp at time zone 'America/Caracas')
      and s.occurred_at < ((p_to + 1)::timestamp at time zone 'America/Caracas')
      and not exists (select 1 from public.sale_voids sv where sv.sale_id = s.id)
      and public.has_role(array['owner', 'admin']::public.app_role[])
  ),
  -- Peso de cada componente dentro de su combo.
  weighted as (
    select
      c.id,
      coalesce(pp.amount_usd, 0) * c.quantity as price_weight,
      c.quantity as quantity_weight
    from sold c
    join public.product_variants v on v.id = c.variant_id
    left join public.product_prices pp on pp.product_id = v.product_id and pp.payment_method_id = c.price_method_id
    where c.parent_item_id is not null
  ),
  lines as (
    select
      p.id as product_id,
      p.name as product_name,
      i.quantity,
      case
        when i.parent_item_id is null then i.line_total_usd
        else parent.line_total_usd * case
          when sum(w.price_weight) over (partition by i.parent_item_id) > 0
            then w.price_weight / sum(w.price_weight) over (partition by i.parent_item_id)
          else w.quantity_weight / sum(w.quantity_weight) over (partition by i.parent_item_id)
        end
      end * i.net_factor as net_usd,
      i.real_factor,
      coalesce(i.unit_cost_usdt, r.unit_cost_usdt) as unit_cost,
      p.labor_cost_usdt
    from sold i
    join public.product_variants v on v.id = i.variant_id
    join public.products p on p.id = v.product_id
    left join sold parent on parent.id = i.parent_item_id
    left join weighted w on w.id = i.id
    left join public.production_runs r on r.sale_item_id = i.id
    where i.source <> 'combo'
  )
  select
    product_id,
    product_name,
    sum(quantity),
    round(sum(net_usd), 2),
    round(sum(net_usd * real_factor), 6),
    round(sum(quantity * coalesce(unit_cost, 0)), 6),
    round(sum(quantity * labor_cost_usdt), 6),
    round(sum(net_usd * real_factor) - sum(quantity * coalesce(unit_cost, 0)) - sum(quantity * labor_cost_usdt), 6),
    count(*) filter (where unit_cost is null)::integer
  from lines
  group by product_id, product_name
  order by 8 desc;
$$;

-- Margen por variante y método de pago, ahora también para combos: el costo del combo es la
-- suma de sus componentes (costo promedio de las variantes activas de cada uno) y su mano de obra.
create or replace function public.product_margins()
returns table (
  product_id uuid,
  product_name text,
  variant_id uuid,
  sku text,
  payment_method_id uuid,
  method_name text,
  price_usd numeric,
  price_usdt numeric,
  material_cost_usdt numeric,
  labor_cost_usdt numeric,
  margin_usdt numeric,
  margin_percent numeric,
  cost_source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rate public.exchange_rates;
  v_row record;
  v_material numeric;
  v_labor numeric;
  v_source text;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    return;
  end if;
  v_rate := public.latest_exchange_rate();
  if v_rate.id is null then
    return;
  end if;

  for v_row in
    select p.id as product_id, p.name as product_name, p.kind, p.labor_cost_usdt, v.id as variant_id, v.sku,
           v.unit_cost_usdt, pm.id as method_id, pm.name as method_name, pm.rate_kind, a.currency, pp.amount_usd
    from public.products p
    join public.product_variants v on v.product_id = p.id and v.is_active
    join public.product_prices pp on pp.product_id = p.id
    join public.payment_methods pm on pm.id = pp.payment_method_id and pm.is_active
    join public.accounts a on a.id = pm.account_id
    where p.kind in ('finished_good', 'combo') and p.is_active
  loop
    v_labor := v_row.labor_cost_usdt;
    if v_row.kind = 'combo' then
      -- Vacío si algún componente no tiene costo.
      select
        case when count(*) = 0 or bool_or(c.avg_cost is null) then null else sum(c.avg_cost * c.quantity) end,
        coalesce(sum(c.labor * c.quantity), 0)
      into v_material, v_labor
      from (
        select cc.quantity, cp.labor_cost_usdt as labor,
               (select avg(cv.unit_cost_usdt) from public.product_variants cv
                where cv.product_id = cc.component_product_id and cv.is_active
                having bool_and(cv.unit_cost_usdt is not null)) as avg_cost
        from public.combo_components cc
        join public.products cp on cp.id = cc.component_product_id
        where cc.combo_product_id = v_row.product_id
      ) c;
      v_source := case when v_material is null then null else 'components' end;
    elsif v_row.unit_cost_usdt is not null then
      v_material := v_row.unit_cost_usdt;
      v_source := 'average';
    else
      -- Estimado con la receta: vacío si falta algún material o su costo.
      select case when count(*) = 0 or bool_or(r.unit_cost_usdt is null) then null
                  else sum(r.quantity * r.unit_cost_usdt) end
        into v_material
      from public.recipe_requirements(v_row.variant_id, 1, false) r;
      v_source := case when v_material is null then null else 'recipe' end;
    end if;

    product_id := v_row.product_id;
    product_name := v_row.product_name;
    variant_id := v_row.variant_id;
    sku := v_row.sku;
    payment_method_id := v_row.method_id;
    method_name := v_row.method_name;
    price_usd := v_row.amount_usd;
    price_usdt := round(
      case v_row.rate_kind
        when 'bcv_usd' then v_row.amount_usd * v_rate.bcv_usd / v_rate.binance_usdt
        when 'bcv_eur' then v_row.amount_usd * v_rate.bcv_eur / v_rate.binance_usdt
        else v_row.amount_usd * v_rate.usd_usdt
      end,
      6
    );
    material_cost_usdt := v_material;
    labor_cost_usdt := v_labor;
    margin_usdt := case when v_material is null then null else round(price_usdt - v_material - v_labor, 6) end;
    margin_percent := case when v_material is null or price_usdt = 0 then null
                           else round(margin_usdt / price_usdt * 100, 2) end;
    cost_source := v_source;
    return next;
  end loop;
end;
$$;

-- ============================================================
-- RLS y permisos
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['combo_components', 'volume_discount_tiers', 'customization_types']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: todo el equipo los ve" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'', ''staff'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin crean" on public.%1$s for insert to authenticated with check (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin editan" on public.%1$s for update to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[])) with check (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end;
$$;

-- Componentes y tramos se pueden quitar; los tipos de personalización solo se desactivan.
create policy "combo_components: owner y admin borran" on public.combo_components for delete to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "volume_discount_tiers: owner y admin borran" on public.volume_discount_tiers for delete to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));

grant insert (combo_product_id, component_product_id, quantity, sort_order),
      update (quantity, sort_order), delete
  on public.combo_components to authenticated;
grant insert (scope, min_quantity, percent), update (min_quantity, percent), delete
  on public.volume_discount_tiers to authenticated;
grant insert (code, name, description, unit_price_usd, min_quantity, max_size_cm, default_size_cm,
              requires_text, requires_logo, sort_order, is_active),
      update (name, description, unit_price_usd, min_quantity, max_size_cm, default_size_cm,
              requires_text, requires_logo, sort_order, is_active)
  on public.customization_types to authenticated;

-- Funciones internas y de triggers: nadie las llama directo.
revoke all on function
  public.products_after_insert_combo(),
  public.products_guard_kind(),
  public.product_variants_guard_combo(),
  public.stock_movements_block_combo(),
  public.combo_components_validate(),
  public.customization_types_guard_code(),
  public.sale_line_after_insert(uuid, jsonb, timestamptz, boolean)
from public, anon, authenticated;

revoke all on function public.volume_discount_percent(public.volume_discount_scope, numeric) from public, anon;
grant execute on function public.volume_discount_percent(public.volume_discount_scope, numeric) to authenticated;
