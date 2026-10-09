-- Corte (Dama, Caballero o Unisex) en la variante, no en el producto.
--
-- · Un producto dice qué cortes ofrece (genders) y cada variante es corte × color × talla, con su stock.
--   Así no hace falta un producto por sexo ("Filipina manga 3/4 dama", "… caballero").
-- · Un producto sin cortes (estuches, gorros…) tiene variantes sin corte, como hasta ahora.
-- · Recargo por talla según el corte: una fila puede ser para todos los cortes (sin corte) o para uno;
--   la del corte manda. Ej.: caballero 3XL +3, 4XL +6…; dama solo 6XL.
-- · Receta por corte: una línea puede ser solo para un corte, como ya podía ser solo para una talla.
-- · El sexo que tenía cada producto pasa a sus variantes. Las filipinas sin sexo, sin stock ni ventas,
--   pasan a Dama y Caballero: sus variantes quedan de Caballero y se crean las de Dama.

-- ============================================================
-- Cortes del producto y corte de la variante
-- ============================================================

alter table public.products add column genders public.product_gender[] not null default '{}'
  check (cardinality(genders) <= 3);
alter table public.product_variants add column gender public.product_gender;

update public.products set genders = array[gender] where gender is not null;
update public.product_variants v set gender = p.gender
from public.products p
where p.id = v.product_id and p.gender is not null;

alter table public.product_variants drop constraint product_variants_unique_combo;
alter table public.product_variants add constraint product_variants_unique_combo
  unique nulls not distinct (product_id, gender, color_id, size_id);

-- La variante solo puede ser de un corte que el producto ofrece (o sin corte si no ofrece ninguno).
create function public.product_variants_check_gender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_genders public.product_gender[];
begin
  select genders into v_genders from public.products where id = new.product_id;
  if cardinality(v_genders) = 0 and new.gender is not null then
    raise exception 'Este producto no tiene cortes: marca primero Dama, Caballero o Unisex en el producto.';
  end if;
  if cardinality(v_genders) > 0 and (new.gender is null or not new.gender = any (v_genders)) then
    raise exception 'Elige el corte de la variante entre los del producto.';
  end if;
  return new;
end;
$$;

create trigger product_variants_check_gender
before insert or update of gender, product_id on public.product_variants
for each row execute function public.product_variants_check_gender();

-- El corte, como el SKU, el color y la talla, no cambia una vez que la variante tiene movimientos.
create or replace function public.product_variants_guard_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.sku is distinct from old.sku
      or new.color_id is distinct from old.color_id
      or new.size_id is distinct from old.size_id
      or new.gender is distinct from old.gender
      or new.product_id is distinct from old.product_id)
     and exists (select 1 from public.stock_movements where variant_id = old.id) then
    raise exception 'La variante % ya tiene movimientos de stock: su SKU, corte, color y talla no se pueden cambiar.', old.sku;
  end if;
  return new;
end;
$$;

grant insert (gender), update (gender) on public.product_variants to authenticated;
grant insert (genders), update (genders) on public.products to authenticated;

-- ============================================================
-- Filipinas que ya existen: Dama y Caballero
-- ============================================================

-- SKU con el código del corte después de la categoría y el modelo (CAT-MODELO-CORTE-…),
-- como lo arma la app. Si no tiene esa forma, el código va al final.
create function public.sku_with_gender(p_sku text, p_prefix text, p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_sku like p_prefix || '-%'
              then p_prefix || '-' || p_code || substr(p_sku, char_length(p_prefix) + 1)
              when p_sku = p_prefix then p_sku || '-' || p_code
              else p_sku || '-' || p_code end
$$;

do $$
declare
  v_product record;
begin
  for v_product in
    select p.id, c.code || coalesce('-' || p.model_code, '') as prefix
    from public.products p
    join public.product_categories c on c.id = p.category_id
    where c.code = 'FIL' and p.kind = 'finished_good' and p.gender is null
      and exists (select 1 from public.product_variants v where v.product_id = p.id)
      -- Sin stock ni ventas: sus variantes todavía se pueden cambiar.
      and not exists (
        select 1 from public.product_variants v
        where v.product_id = p.id
          and (exists (select 1 from public.stock_movements m where m.variant_id = v.id)
               or exists (select 1 from public.sale_items i where i.variant_id = v.id)
               or exists (select 1 from public.quote_items q where q.variant_id = v.id))
      )
  loop
    update public.products set genders = array['men', 'women']::public.product_gender[] where id = v_product.id;
    -- Las de Dama, copia de las actuales (mismo color, talla, mínimo y estado).
    insert into public.product_variants (product_id, color_id, size_id, gender, sku, min_stock, is_active, created_by)
    select v.product_id, v.color_id, v.size_id, 'women', public.sku_with_gender(v.sku, v_product.prefix, 'D'),
           v.min_stock, v.is_active, v.created_by
    from public.product_variants v
    where v.product_id = v_product.id and v.gender is null;
    -- Las actuales pasan a Caballero.
    update public.product_variants
    set gender = 'men', sku = public.sku_with_gender(sku, v_product.prefix, 'C')
    where product_id = v_product.id and gender is null;
  end loop;
end;
$$;

-- El sexo ya vive en las variantes.
alter table public.products drop column gender;

-- ============================================================
-- Recargo por talla según el corte
-- ============================================================

alter table public.size_surcharges drop constraint size_surcharges_pkey;
alter table public.size_surcharges add column id uuid not null default gen_random_uuid() primary key;
-- Vacío = todos los cortes; con corte = solo ese (y manda sobre el de todos).
alter table public.size_surcharges add column gender public.product_gender;
alter table public.size_surcharges add constraint size_surcharges_unique unique nulls not distinct (size_id, product_id, gender);
grant insert (gender), update (gender) on public.size_surcharges to authenticated;

-- Recargo de una talla para un corte: el del corte o, si no hay, el de todos.
create function public.size_surcharge_usd(p_product_id uuid, p_size_id uuid, p_gender public.product_gender)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select ss.amount_usd from public.size_surcharges ss
    where ss.product_id = p_product_id and ss.size_id = p_size_id and (ss.gender = p_gender or ss.gender is null)
    order by ss.gender is null
    limit 1
  ), 0)
$$;

create or replace function public.variant_price_usd(p_variant_id uuid, p_method_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select pp.amount_usd
         + case when p.kind = 'finished_good' then public.size_surcharge_usd(v.product_id, v.size_id, v.gender) else 0 end
         + coalesce(cs.amount_usd, 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  join public.product_prices pp on pp.product_id = v.product_id and pp.payment_method_id = p_method_id
  left join public.color_surcharges cs on cs.product_id = v.product_id and cs.color_id = v.color_id and p.kind = 'finished_good'
  where v.id = p_variant_id
$$;

create or replace function public.variant_surcharge_usd(p_variant_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case when p.kind = 'finished_good' then public.size_surcharge_usd(v.product_id, v.size_id, v.gender) else 0 end
         + coalesce(cs.amount_usd, 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.color_surcharges cs on cs.product_id = v.product_id and cs.color_id = v.color_id and p.kind = 'finished_good'
  where v.id = p_variant_id
$$;

-- Todos los recargos por talla de un producto en un paso (la tabla de su página): reemplaza los que tenía.
-- p_rows: [{ "size_id", "gender" (o null = todos), "amount_usd" }]. Con los permisos de quien llama.
create function public.save_product_size_surcharges(p_product_id uuid, p_rows jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner o admin cargan recargos.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]')) <> 'array' then
    raise exception 'Recargos inválidos.';
  end if;
  delete from public.size_surcharges where product_id = p_product_id;
  insert into public.size_surcharges (size_id, product_id, gender, amount_usd)
  select (r ->> 'size_id')::uuid, p_product_id, nullif(r ->> 'gender', '')::public.product_gender, (r ->> 'amount_usd')::numeric
  from jsonb_array_elements(coalesce(p_rows, '[]')) r;
end;
$$;

-- ============================================================
-- Receta por corte
-- ============================================================

alter table public.product_recipe_lines add column gender public.product_gender;
drop index public.product_recipe_lines_unique;
create unique index product_recipe_lines_unique
  on public.product_recipe_lines (
    product_id,
    coalesce(raw_variant_id, raw_product_id),
    coalesce(size_id, '00000000-0000-0000-0000-000000000000'::uuid),
    gender
  ) nulls not distinct;
grant insert (gender), update (gender) on public.product_recipe_lines to authenticated;

create or replace function public.recipe_requirements(p_variant_id uuid, p_quantity numeric, p_strict boolean default true)
returns table (raw_variant_id uuid, quantity numeric, unit_cost_usdt numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_variant public.product_variants;
  v_line record;
  v_material record;
  v_color text;
  v_resolved uuid;
begin
  select * into v_variant from public.product_variants where id = p_variant_id;
  if not found then
    raise exception 'La variante no existe.';
  end if;

  for v_line in
    select distinct on (coalesce(l.raw_variant_id, l.raw_product_id)) l.*
    from public.product_recipe_lines l
    where l.product_id = v_variant.product_id
      and (l.size_id = v_variant.size_id or l.size_id is null)
      and (l.gender = v_variant.gender or l.gender is null)
    -- Por material, la línea más específica: talla y corte, luego solo talla, solo corte, la de todos.
    order by coalesce(l.raw_variant_id, l.raw_product_id), (l.size_id is null), (l.gender is null)
  loop
    if v_line.raw_variant_id is not null then
      v_resolved := v_line.raw_variant_id;
    else
      v_resolved := null;
      if v_variant.color_id is not null then
        select v.id into v_resolved
        from public.product_variants v
        where v.product_id = v_line.raw_product_id and v.color_id = v_variant.color_id and v.is_active
        limit 1;
      end if;
      if v_resolved is null then
        if not p_strict then
          raw_variant_id := null;
          quantity := round(v_line.quantity * p_quantity, 3);
          unit_cost_usdt := null;
          return next;
          continue;
        end if;
        select name into v_material from public.products where id = v_line.raw_product_id;
        select name into v_color from public.colors where id = v_variant.color_id;
        if v_color is null then
          raise exception 'La prenda % no tiene color y su receta pide "%" del mismo color.', v_variant.sku, v_material.name;
        end if;
        raise exception 'No hay "%" en color %. Créalo en Materia prima antes de producir %.',
          v_material.name, v_color, v_variant.sku;
      end if;
    end if;

    raw_variant_id := v_resolved;
    quantity := round(v_line.quantity * p_quantity, 3);
    select v.unit_cost_usdt into unit_cost_usdt from public.product_variants v where v.id = v_resolved;
    return next;
  end loop;
end;
$$;

-- ============================================================
-- Presupuestos: el género de cada línea, como el color y la talla
-- ============================================================

alter table public.quote_items add column gender public.product_gender;

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
-- Margen: el recargo de la talla según el corte de la variante
-- ============================================================

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
           v.unit_cost_usdt, pm.id as method_id, pm.name as method_name, pm.rate_kind, a.currency, pp.amount_usd + case when p.kind = 'finished_good' then public.size_surcharge_usd(p.id, v.size_id, v.gender) else 0 end + coalesce(cs.amount_usd, 0) as amount_usd
    from public.products p
    join public.product_variants v on v.product_id = p.id and v.is_active
    join public.product_prices pp on pp.product_id = p.id
    join public.payment_methods pm on pm.id = pp.payment_method_id and pm.is_active
    join public.accounts a on a.id = pm.account_id
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
-- Permisos
-- ============================================================

revoke all on function
  public.product_variants_check_gender(),
  public.sku_with_gender(text, text, text)
from public, anon, authenticated;

-- La usa el precio de cada variante (que también llama quien vende).
revoke all on function public.size_surcharge_usd(uuid, uuid, public.product_gender) from public, anon;
grant execute on function public.size_surcharge_usd(uuid, uuid, public.product_gender) to authenticated;

revoke all on function public.save_product_size_surcharges(uuid, jsonb) from public, anon;
grant execute on function public.save_product_size_surcharges(uuid, jsonb) to authenticated;
