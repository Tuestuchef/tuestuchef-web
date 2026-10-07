-- Combos con opciones: cada componente del combo es un espacio ("1 filipina manga corta") que acepta
-- uno o varios productos (botón, cierre o broche). Al vender se elige el producto, la talla y el color.
--
-- · combo_components pasa a ser el espacio: cantidad, orden y un nombre opcional.
-- · combo_component_options: los productos que acepta cada espacio. Un producto va en un solo espacio
--   del combo, así cada pieza vendida sabe a qué espacio pertenece.
-- · Los componentes que ya existían quedan como espacios con una sola opción: nada cambia para ellos.
-- · Recargo en combos: cada pieza lleva el recargo de su talla y su color en su propia línea, encima
--   del precio del combo (antes iban a precio 0). En presupuestos igual, y pasa tal cual al pedido.
-- · Margen de catálogo del combo: típico (por lo vendido en 90 días) y rango (modelo más barato a más caro).

-- ============================================================
-- Espacios y opciones
-- ============================================================

alter table public.combo_components add column label text check (char_length(label) between 1 and 80);

create table public.combo_component_options (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.combo_components (id) on delete cascade,
  -- Copia del combo del espacio (la pone un trigger): un producto no se repite en el mismo combo.
  combo_product_id uuid not null references public.products (id) on delete cascade,
  product_id uuid not null references public.products (id),
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint combo_component_options_unique unique (combo_product_id, product_id)
);

create index combo_component_options_component_idx on public.combo_component_options (component_id, sort_order);

-- Cada componente que ya existía es un espacio con su producto como única opción.
insert into public.combo_component_options (component_id, combo_product_id, product_id, sort_order, created_by, created_at)
select id, combo_product_id, component_product_id, 1, created_by, created_at from public.combo_components;

alter table public.combo_components
  drop constraint combo_components_unique,
  drop constraint combo_components_not_self,
  drop column component_product_id;

create or replace function public.combo_components_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select kind from public.products where id = new.combo_product_id) is distinct from 'combo' then
    raise exception 'Solo un combo lleva componentes.';
  end if;
  return new;
end;
$$;

create or replace function public.combo_component_options_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.product_kind;
begin
  select combo_product_id into new.combo_product_id from public.combo_components where id = new.component_id;
  select kind into v_kind from public.products where id = new.product_id;
  if v_kind is distinct from 'finished_good' then
    raise exception 'Los componentes de un combo son productos terminados (no materia prima ni otro combo).';
  end if;
  return new;
end;
$$;

create trigger combo_component_options_validate
before insert or update on public.combo_component_options
for each row execute function public.combo_component_options_validate();

create trigger combo_component_options_created_audit before insert on public.combo_component_options
  for each row execute function public.set_created_audit();
create trigger combo_component_options_updated_audit before update on public.combo_component_options
  for each row execute function public.set_updated_audit();

alter table public.combo_component_options enable row level security;

create policy "combo_component_options: todo el equipo los ve" on public.combo_component_options for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "combo_component_options: owner y admin crean" on public.combo_component_options for insert to authenticated
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "combo_component_options: owner y admin editan" on public.combo_component_options for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "combo_component_options: owner y admin quitan" on public.combo_component_options for delete to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.combo_component_options from anon, authenticated;
grant select, delete on public.combo_component_options to authenticated;
grant insert (component_id, product_id, sort_order), update (sort_order) on public.combo_component_options to authenticated;

grant insert (label), update (label) on public.combo_components to authenticated;

-- Crear o editar un espacio con sus productos en un solo paso (con los permisos de quien llama).
create function public.save_combo_component(
  p_combo_product_id uuid,
  p_component_id uuid,
  p_label text,
  p_quantity integer,
  p_product_ids uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := p_component_id;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner o admin arman los combos.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_product_ids), 0) = 0 then
    raise exception 'Elige al menos un producto.';
  end if;

  if v_id is null then
    insert into public.combo_components (combo_product_id, quantity, label, sort_order)
    values (
      p_combo_product_id, p_quantity, nullif(trim(p_label), ''),
      coalesce((select max(sort_order) from public.combo_components where combo_product_id = p_combo_product_id), 0) + 1
    )
    returning id into v_id;
  else
    update public.combo_components set quantity = p_quantity, label = nullif(trim(p_label), '')
    where id = v_id and combo_product_id = p_combo_product_id;
    if not found then
      raise exception 'Ese componente ya no existe.';
    end if;
  end if;

  delete from public.combo_component_options where component_id = v_id and product_id <> all (p_product_ids);
  begin
    insert into public.combo_component_options (component_id, product_id, sort_order)
    select v_id, x.product_id, x.ord
    from unnest(p_product_ids) with ordinality as x (product_id, ord)
    where not exists (select 1 from public.combo_component_options o where o.component_id = v_id and o.product_id = x.product_id);
  exception when unique_violation then
    raise exception 'Un producto ya está en otro componente del combo: cada producto va en uno solo.';
  end;
  update public.combo_component_options o set sort_order = x.ord
  from unnest(p_product_ids) with ordinality as x (product_id, ord)
  where o.component_id = v_id and o.product_id = x.product_id and o.sort_order <> x.ord;
  return v_id;
end;
$$;

-- Los espacios de un combo con su nombre (el propio, o sus productos: "Filipina botón / Filipina cierre").
create function public.combo_slots(p_combo_product_id uuid)
returns table (id uuid, quantity integer, name text)
language sql
stable
set search_path = ''
as $$
  select cc.id, cc.quantity,
         coalesce(cc.label, string_agg(p.name, ' / ' order by o.sort_order, p.name), 'un componente sin productos')
  from public.combo_components cc
  left join public.combo_component_options o on o.component_id = cc.id
  left join public.products p on p.id = o.product_id
  where cc.combo_product_id = p_combo_product_id
  group by cc.id, cc.quantity, cc.label, cc.sort_order
  order by cc.sort_order;
$$;

-- Recargo de una variante (talla + color), solo en productos terminados. En un combo, cada pieza lo
-- suma encima del precio del combo.
create function public.variant_surcharge_usd(p_variant_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(ss.amount_usd, 0) + coalesce(cs.amount_usd, 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.size_surcharges ss on ss.product_id = v.product_id and ss.size_id = v.size_id and p.kind = 'finished_good'
  left join public.color_surcharges cs on cs.product_id = v.product_id and cs.color_id = v.color_id and p.kind = 'finished_good'
  where v.id = p_variant_id
$$;

-- Las piezas de un combo pueden llevar recargo (antes siempre iban a 0).
alter table public.sale_items drop constraint sale_items_price_by_kind;
alter table public.sale_items add constraint sale_items_price_by_kind check (
  (parent_item_id is null and unit_price_usd > 0)
  or (parent_item_id is not null and source <> 'combo' and unit_price_usd >= 0 and line_total_usd >= 0)
);

-- ============================================================
-- Costo de catálogo de un combo
-- ============================================================

-- Por espacio:
-- · típico: costo promedio de lo vendido de sus productos (sueltos o en combos) en los últimos 90 días,
--   ponderado por piezas. Sin ventas, el promedio simple de sus productos.
-- · rango: del producto más barato al más caro (costo promedio de sus variantes + mano de obra), para
--   que una talla que casi no se vende no distorsione.
-- Vacío si algún producto de algún espacio no tiene costo.
create function public.combo_cost(p_combo_product_id uuid)
returns table (material_usdt numeric, labor_usdt numeric, min_usdt numeric, max_usdt numeric, from_sales boolean)
language sql
stable
set search_path = ''
as $$
  with options as (
    select cc.id as slot_id, cc.quantity as slot_quantity, p.id as product_id, p.labor_cost_usdt as labor,
           (select avg(v.unit_cost_usdt) from public.product_variants v
            where v.product_id = p.id and v.is_active
            having bool_and(v.unit_cost_usdt is not null)) as avg_cost
    from public.combo_components cc
    join public.combo_component_options o on o.component_id = cc.id
    join public.products p on p.id = o.product_id
    where cc.combo_product_id = p_combo_product_id
  ),
  slots as (
    select slot_id, max(slot_quantity) as slot_quantity, bool_or(avg_cost is null) as missing,
           avg(avg_cost) as simple_material, avg(labor) as simple_labor,
           min(avg_cost + labor) as min_cost, max(avg_cost + labor) as max_cost
    from options
    group by slot_id
  ),
  sold as (
    select o.slot_id, sum(i.quantity) as pieces,
           sum(i.quantity * coalesce(v.unit_cost_usdt, o.avg_cost)) as material,
           sum(i.quantity * o.labor) as labor
    from options o
    join public.product_variants v on v.product_id = o.product_id
    join public.sale_items i on i.variant_id = v.id and i.source <> 'combo'
    join public.sales s on s.id = i.sale_id
    where s.occurred_at >= now() - interval '90 days'
      and not exists (select 1 from public.sale_voids sv where sv.sale_id = s.id)
    group by o.slot_id
  )
  select
    case when count(*) = 0 or bool_or(sl.missing) then null
         else round(sum(sl.slot_quantity * coalesce(sd.material / sd.pieces, sl.simple_material)), 6) end,
    round(coalesce(sum(sl.slot_quantity * coalesce(sd.labor / sd.pieces, sl.simple_labor)), 0), 6),
    case when count(*) = 0 or bool_or(sl.missing) then null else round(sum(sl.slot_quantity * sl.min_cost), 6) end,
    case when count(*) = 0 or bool_or(sl.missing) then null else round(sum(sl.slot_quantity * sl.max_cost), 6) end,
    coalesce(bool_or(sd.pieces > 0), false)
  from slots sl
  left join sold sd on sd.slot_id = sl.slot_id;
$$;

drop function public.product_margins();

create function public.product_margins()
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
  cost_source text,
  -- Solo combos: costo (materiales + mano de obra) con el producto más barato y el más caro de cada componente.
  cost_min_usdt numeric,
  cost_max_usdt numeric
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
  v_min numeric;
  v_max numeric;
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
           v.unit_cost_usdt, pm.id as method_id, pm.name as method_name, pm.rate_kind, a.currency, pp.amount_usd + coalesce(ss.amount_usd, 0) + coalesce(cs.amount_usd, 0) as amount_usd
    from public.products p
    join public.product_variants v on v.product_id = p.id and v.is_active
    join public.product_prices pp on pp.product_id = p.id
    join public.payment_methods pm on pm.id = pp.payment_method_id and pm.is_active
    join public.accounts a on a.id = pm.account_id
    -- Recargo de la talla de la variante (solo productos terminados).
    left join public.size_surcharges ss on ss.product_id = p.id and ss.size_id = v.size_id and p.kind = 'finished_good'
    -- Recargo del color (o estampado) de la variante.
    left join public.color_surcharges cs on cs.product_id = p.id and cs.color_id = v.color_id and p.kind = 'finished_good'
    where p.kind in ('finished_good', 'combo') and p.is_active
  loop
    v_labor := v_row.labor_cost_usdt;
    v_min := null;
    v_max := null;
    if v_row.kind = 'combo' then
      -- Típico (por lo que más se vende) y rango (del producto más barato al más caro de cada componente).
      select c.material_usdt, c.labor_usdt, c.min_usdt, c.max_usdt,
             case when c.material_usdt is null then null when c.from_sales then 'sales_mix' else 'components' end
        into v_material, v_labor, v_min, v_max, v_source
      from public.combo_cost(v_row.product_id) c;
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
    cost_min_usdt := v_min;
    cost_max_usdt := v_max;
    return next;
  end loop;
end;
$$;

-- ============================================================
-- Ventas y pedidos: cualquier producto del componente, con su recargo
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
      -- Precio del producto para el método + recargo de la talla de esta variante.
      v_price := public.variant_price_usd(v_variant.id, p_price_method_id);
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
          v_c_slot uuid;
          v_c_price numeric;
          v_c_total numeric;
        begin
          if v_c_quantity is null or v_c_quantity <= 0 then
            raise exception 'Cantidad inválida en un componente de "%".', v_product.name;
          end if;
          select * into v_c_variant from public.product_variants where id = (v_component ->> 'variant_id')::uuid;
          if not found then
            raise exception 'Un componente de "%" ya no existe.', v_product.name;
          end if;
          select * into v_c_product from public.products where id = v_c_variant.product_id;
          -- El componente (espacio) del combo al que pertenece la pieza: un producto va en uno solo.
          select o.component_id into v_c_slot from public.combo_component_options o
          where o.combo_product_id = v_product.id and o.product_id = v_c_product.id;
          if v_c_slot is null then
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
          -- Recargo de la talla y el color de la pieza, encima del precio del combo
          -- (desde un presupuesto, el que dice el presupuesto).
          if v_quote_mode then
            v_c_price := coalesce((v_component ->> 'price')::numeric, 0);
            v_c_total := coalesce((v_component ->> 'line_total')::numeric, round(v_c_price * v_c_quantity, 2));
          else
            v_c_price := public.variant_surcharge_usd(v_c_variant.id);
            v_c_total := round(v_c_price * v_c_quantity, 2);
          end if;
          v_products_subtotal := v_products_subtotal + v_c_total;
          v_children := v_children || jsonb_build_object(
            'variant_id', v_c_variant.id, 'product_id', v_c_product.id, 'slot_id', v_c_slot, 'quantity', v_c_quantity,
            'source', v_c_source, 'reserved_quantity', v_c_reserved, 'cost', v_c_variant.unit_cost_usdt,
            'price', v_c_price, 'line_total', v_c_total
          );
          v_pieces := v_pieces + v_c_quantity;
        end;
      end loop;

      -- Por componente: lo elegido (de cualquiera de sus productos) debe sumar su cantidad × combos.
      for v_def in select * from public.combo_slots(v_product.id) loop
        select coalesce(sum((c ->> 'quantity')::numeric), 0) into v_given
        from jsonb_array_elements(v_children) c
        where (c ->> 'slot_id')::uuid = v_def.id;
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
          v_sale_id, v_parent_id, (v_child ->> 'variant_id')::uuid, (v_child ->> 'quantity')::numeric,
          (v_child ->> 'price')::numeric, (v_child ->> 'line_total')::numeric,
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
          v_components := v_components || (jsonb_build_object(
            'variant_id', v_c_variant.id, 'quantity', v_c_qty, 'source', v_c_source,
            'reserved_quantity', case when v_c_source = 'made_to_order' then v_c_reserve else 0 end
          ) || case when v_quote_mode then jsonb_strip_nulls(jsonb_build_object(
            'price', v_component -> 'price', 'line_total', v_component -> 'line_total'
          )) else '{}'::jsonb end);
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
          'line_total', case p_currency when 'usd' then c.usd_line_total else c.ves_line_total end
        ) order by c.position), '[]')
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
-- Presupuestos: igual, en cada lista
-- ============================================================

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
          v_c_slot uuid;
          v_c_price numeric;
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
            quote_id, parent_item_id, position, kind, variant_id, product_name, sku, color_name, size_name, size_sort, quantity,
            discount_percent, usd_unit_price, ves_unit_price, usd_line_total, ves_line_total
          )
          select p_quote_id, v_item_id, v_position, 'component', v_c_variant.id, v_c_product.name, v_c_variant.sku, c.name, s.name, s.sort_order, v_c_qty,
            v_line_discount,
            case when v_use_usd then v_c_price else 0 end,
            case when v_use_ves then v_c_price else 0 end,
            case when v_use_usd then round(v_c_price * v_c_qty * (1 - v_line_discount / 100), 2) else 0 end,
            case when v_use_ves then round(v_c_price * v_c_qty * (1 - v_line_discount / 100), 2) else 0 end
          from (select 1) x
          left join public.colors c on c.id = v_c_variant.color_id
          left join public.sizes s on s.id = v_c_variant.size_id;
          v_position := v_position + 1;
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

-- ============================================================
-- Margen por producto vendido: el recargo de la pieza cuenta para ella
-- ============================================================

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
        -- Pieza de un combo: su parte del combo + su propio recargo.
        else i.line_total_usd + parent.line_total_usd * case
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

-- ============================================================
-- Permisos
-- ============================================================

revoke all on function
  public.combo_component_options_validate(),
  public.combo_slots(uuid),
  public.variant_surcharge_usd(uuid),
  public.combo_cost(uuid)
from public, anon, authenticated;

revoke all on function public.save_combo_component(uuid, uuid, text, integer, uuid[]) from public, anon;
grant execute on function public.save_combo_component(uuid, uuid, text, integer, uuid[]) to authenticated;

revoke execute on function public.product_margins() from public, anon;
grant execute on function public.product_margins() to authenticated;
