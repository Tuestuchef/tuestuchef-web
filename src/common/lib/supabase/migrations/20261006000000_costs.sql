-- Fase 2 · Costos: costo promedio ponderado, recetas, producción con consumo de materia
-- prima y margen por producto. Modelo en docs/modelo-de-datos.md (sección 7).
-- - unit_cost_usdt de cada variante pasa a ser el costo promedio ponderado. El valor que
--   cada variante tenga al aplicar esta migración es el punto de partida del promedio.
-- - Receta por producto terminado: material específico o "mismo color que la prenda",
--   con cantidad por defecto y, opcional, por talla.
-- - Producción (de stock o de un encargo) consume la materia prima de la receta.
--   Las diferencias reales (merma) se corrigen con un ajuste de owner o admin con nota.
-- - La mano de obra por unidad (products.labor_cost_usdt) solo se usa para el margen:
--   nunca entra al costo del inventario ni se resta de la utilidad real (los sueldos ya se restan).

-- ============================================================
-- Mano de obra por unidad (solo para el margen)
-- ============================================================

alter table public.products
  add column labor_cost_usdt numeric(20, 6) not null default 0 check (labor_cost_usdt >= 0);

grant insert (labor_cost_usdt), update (labor_cost_usdt) on public.products to authenticated;

-- ============================================================
-- Costo promedio ponderado (reemplaza "último costo")
-- ============================================================

create or replace function public.stock_movements_update_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_after numeric;
  v_before numeric;
  v_avg numeric;
  v_new numeric;
begin
  if new.unit_cost_usdt is null then
    return null;
  end if;

  -- Trigger AFTER: el saldo ya incluye este movimiento.
  select coalesce(sum(quantity), 0) into v_after from public.stock_movements where variant_id = new.variant_id;
  v_before := v_after - new.quantity;
  select unit_cost_usdt into v_avg from public.product_variants where id = new.variant_id;

  if new.movement_type in ('initial_count', 'purchase', 'production', 'sale_reversal') and new.quantity > 0 then
    -- Entrada con costo: promedia con lo que había (o arranca si no había nada).
    if v_before <= 0 or v_avg is null then
      v_new := new.unit_cost_usdt;
    else
      v_new := round((v_before * v_avg + new.quantity * new.unit_cost_usdt) / v_after, 6);
    end if;
  elsif new.movement_type = 'purchase_reversal' and v_avg is not null and v_after > 0 then
    -- Sale lo que entró por una compra anulada: se quita su costo del promedio.
    v_new := round((v_before * v_avg + new.quantity * new.unit_cost_usdt) / v_after, 6);
    if v_new <= 0 then
      v_new := v_avg;
    end if;
  else
    -- Salidas (ventas, consumo, ajustes) no cambian el costo promedio.
    return null;
  end if;

  update public.product_variants set unit_cost_usdt = v_new where id = new.variant_id;
  return null;
end;
$$;

-- ============================================================
-- Recetas
-- ============================================================

create table public.product_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  -- Producto terminado al que pertenece la receta.
  product_id uuid not null references public.products (id),
  -- Material específico (variante de materia prima)…
  raw_variant_id uuid references public.product_variants (id),
  -- …o material "del mismo color que la prenda" (producto de materia prima).
  raw_product_id uuid references public.products (id),
  -- Vacío = cantidad por defecto; con talla = cantidad para esa talla.
  size_id uuid references public.sizes (id),
  quantity numeric(12, 4) not null check (quantity > 0),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint product_recipe_lines_one_material check (num_nonnulls(raw_variant_id, raw_product_id) = 1)
);

create unique index product_recipe_lines_unique
  on public.product_recipe_lines (
    product_id,
    coalesce(raw_variant_id, raw_product_id),
    coalesce(size_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index product_recipe_lines_product_idx on public.product_recipe_lines (product_id);

create trigger product_recipe_lines_created_audit before insert on public.product_recipe_lines
  for each row execute function public.set_created_audit();
create trigger product_recipe_lines_updated_audit before update on public.product_recipe_lines
  for each row execute function public.set_updated_audit();

-- La receta es de un producto terminado y sus materiales son materia prima.
create or replace function public.product_recipe_lines_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.product_kind;
  v_material_kind public.product_kind;
begin
  select kind into v_kind from public.products where id = new.product_id;
  if v_kind <> 'finished_good' then
    raise exception 'Solo los productos terminados llevan receta.';
  end if;

  if new.raw_variant_id is not null then
    select p.kind into v_material_kind
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = new.raw_variant_id;
  else
    select kind into v_material_kind from public.products where id = new.raw_product_id;
  end if;
  if v_material_kind is distinct from 'raw_material' then
    raise exception 'Los materiales de una receta deben ser materia prima.';
  end if;
  return new;
end;
$$;

create trigger product_recipe_lines_validate before insert or update on public.product_recipe_lines
  for each row execute function public.product_recipe_lines_validate();

-- Materiales que lleva una cantidad de prendas de una variante.
-- Por material: la cantidad de su talla si existe; si no, la de por defecto.
-- "Mismo color": busca la variante de ese material con el color de la prenda.
-- p_strict = false no falla: devuelve el material sin resolver con variante y costo vacíos
-- (el margen queda vacío en vez de subestimar el costo).
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
    order by coalesce(l.raw_variant_id, l.raw_product_id), (l.size_id is null)
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
-- Producción
-- ============================================================

create table public.production_runs (
  id uuid primary key default gen_random_uuid(),
  -- Prenda producida.
  variant_id uuid not null references public.product_variants (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  -- Costo de materiales por unidad (o el indicado si el producto no tiene receta).
  unit_cost_usdt numeric(20, 6) not null check (unit_cost_usdt >= 0),
  -- Encargo: consume materia prima sin sumar stock de producto terminado. Una sola vez por línea.
  sale_item_id uuid unique references public.sale_items (id),
  note text check (note is null or length(note) <= 300),
  occurred_at timestamptz not null default now(),
  is_backdated boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index production_runs_variant_idx on public.production_runs (variant_id, occurred_at desc);

create trigger production_runs_immutable before update or delete on public.production_runs
  for each row execute function public.prevent_mutation();
create trigger production_runs_no_truncate before truncate on public.production_runs
  for each statement execute function public.prevent_mutation();

alter table public.stock_movements add column production_run_id uuid references public.production_runs (id);

-- Producción y consumo solo desde register_production (o al marcar un encargo como listo).
create or replace function public.stock_movements_guard_production()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.movement_type in ('production', 'consumption')
     and coalesce(current_setting('app.creating_production', true), '') = '' then
    raise exception 'La producción se registra desde Stock → Producción (consume la materia prima de la receta).';
  end if;
  if new.movement_type = 'consumption' and new.quantity > 0 then
    raise exception 'Cantidad inválida para un movimiento de tipo consumption.';
  end if;
  return new;
end;
$$;

create trigger stock_movements_guard_production
before insert on public.stock_movements
for each row execute function public.stock_movements_guard_production();

-- Consume la receta de una corrida de producción. Interna.
create or replace function public.consume_recipe(
  p_run_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_occurred_at timestamptz,
  p_label text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
  v_total numeric := 0;
  v_sku text;
begin
  for v_req in select * from public.recipe_requirements(p_variant_id, p_quantity, true) loop
    if v_req.unit_cost_usdt is null then
      select sku into v_sku from public.product_variants where id = v_req.raw_variant_id;
      raise exception 'El material % no tiene costo todavía: regístralo con una compra o la carga inicial.', v_sku;
    end if;
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, production_run_id, occurred_at, note)
    values (v_req.raw_variant_id, 'consumption', -v_req.quantity, v_req.unit_cost_usdt, p_run_id, p_occurred_at, p_label);
    v_total := v_total + v_req.quantity * v_req.unit_cost_usdt;
  end loop;
  return v_total;
end;
$$;

-- Registra producción para stock: consume la receta y suma las prendas al inventario
-- con el costo de los materiales consumidos. Sin receta, se indica el costo unitario.
create or replace function public.register_production(
  p_variant_id uuid,
  p_quantity numeric,
  p_unit_cost_usdt numeric default null,
  p_note text default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_date date;
  v_variant public.product_variants;
  v_product public.products;
  v_has_recipe boolean;
  v_run_id uuid;
  v_materials numeric;
  v_unit_cost numeric;
  v_label text;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar producción.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Cantidad inválida.';
  end if;
  v_date := public.check_occurred_at(v_at);

  select * into v_variant from public.product_variants where id = p_variant_id;
  if not found then
    raise exception 'La variante no existe.';
  end if;
  select * into v_product from public.products where id = v_variant.product_id;
  if v_product.kind <> 'finished_good' then
    raise exception 'La materia prima no se produce: se compra.';
  end if;
  if v_product.fulfillment_type = 'made_to_order' then
    raise exception '"%" es por encargo: se produce al avanzar la línea de la venta.', v_product.name;
  end if;

  v_has_recipe := exists (select 1 from public.product_recipe_lines where product_id = v_product.id);
  if not v_has_recipe and p_unit_cost_usdt is null then
    raise exception '"%" no tiene receta: indica el costo unitario o crea su receta.', v_product.name;
  end if;
  if p_unit_cost_usdt is not null and p_unit_cost_usdt < 0 then
    raise exception 'Costo unitario inválido.';
  end if;

  v_label := 'Producción de ' || trim_scale(p_quantity) || ' × ' || v_variant.sku;

  -- La corrida se crea primero (los movimientos la referencian); su costo se calcula
  -- antes de insertarla resolviendo la receta sin consumir.
  if v_has_recipe then
    select coalesce(sum(r.quantity * r.unit_cost_usdt), 0) into v_materials
    from public.recipe_requirements(p_variant_id, p_quantity, true) r;
    v_unit_cost := round(v_materials / p_quantity, 6);
  else
    v_unit_cost := p_unit_cost_usdt;
  end if;

  insert into public.production_runs (variant_id, quantity, unit_cost_usdt, note, occurred_at, is_backdated)
  values (p_variant_id, p_quantity, v_unit_cost, nullif(trim(p_note), ''), v_at, v_date < public.caracas_today())
  returning id into v_run_id;

  perform set_config('app.creating_production', v_run_id::text, true);
  if v_has_recipe then
    perform public.consume_recipe(v_run_id, p_variant_id, p_quantity, v_at, v_label);
  end if;
  insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, production_run_id, occurred_at, note)
  values (p_variant_id, 'production', p_quantity, v_unit_cost, v_run_id, v_at, coalesce(nullif(trim(p_note), ''), v_label));
  perform set_config('app.creating_production', '', true);

  return v_run_id;
end;
$$;

-- Encargo producido: consume la receta de la línea (sin sumar stock). Interna; una sola vez.
create or replace function public.consume_for_sale_item(p_sale_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.sale_items;
  v_sku text;
  v_cost numeric;
  v_run_id uuid;
begin
  select * into v_item from public.sale_items where id = p_sale_item_id;
  if v_item.source <> 'made_to_order' or exists (select 1 from public.production_runs where sale_item_id = p_sale_item_id) then
    return;
  end if;
  if not exists (
    select 1 from public.product_recipe_lines l
    join public.product_variants v on v.product_id = l.product_id
    where v.id = v_item.variant_id
  ) then
    -- Sin receta no hay nada que consumir.
    return;
  end if;

  select sku into v_sku from public.product_variants where id = v_item.variant_id;
  select coalesce(sum(r.quantity * r.unit_cost_usdt), 0) into v_cost
  from public.recipe_requirements(v_item.variant_id, v_item.quantity, true) r;

  insert into public.production_runs (variant_id, quantity, unit_cost_usdt, sale_item_id, note)
  values (v_item.variant_id, v_item.quantity, round(v_cost / v_item.quantity, 6), p_sale_item_id, 'Encargo producido')
  returning id into v_run_id;

  perform set_config('app.creating_production', v_run_id::text, true);
  perform public.consume_recipe(v_run_id, v_item.variant_id, v_item.quantity, now(),
    'Encargo: ' || trim_scale(v_item.quantity) || ' × ' || v_sku);
  perform set_config('app.creating_production', '', true);
end;
$$;

-- Avanzar estados: al llegar a "listo" (o saltar a "entregado") un encargo consume su receta.
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
-- Margen por variante y método de pago (owner y admin)
-- ============================================================

-- Precio en valor real (USDT) según cómo cobra cada método, con las tasas vigentes;
-- costo = promedio ponderado (o receta si aún no tiene) + mano de obra por unidad.
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
    select p.id as product_id, p.name as product_name, p.labor_cost_usdt, v.id as variant_id, v.sku, v.unit_cost_usdt,
           pm.id as method_id, pm.name as method_name, pm.rate_kind, a.currency, pp.amount_usd
    from public.products p
    join public.product_variants v on v.product_id = p.id and v.is_active
    join public.product_prices pp on pp.product_id = p.id
    join public.payment_methods pm on pm.id = pp.payment_method_id and pm.is_active
    join public.accounts a on a.id = pm.account_id
    where p.kind = 'finished_good' and p.is_active
  loop
    if v_row.unit_cost_usdt is not null then
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
    labor_cost_usdt := v_row.labor_cost_usdt;
    margin_usdt := case when v_material is null then null else round(price_usdt - v_material - v_row.labor_cost_usdt, 6) end;
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

alter table public.product_recipe_lines enable row level security;

create policy "product_recipe_lines: todo el equipo las ve"
on public.product_recipe_lines for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "product_recipe_lines: owner y admin crean"
on public.product_recipe_lines for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "product_recipe_lines: owner y admin editan"
on public.product_recipe_lines for update
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]))
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "product_recipe_lines: owner y admin borran"
on public.product_recipe_lines for delete
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

alter table public.production_runs enable row level security;

create policy "production_runs: todo el equipo las ve"
on public.production_runs for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

revoke all on table public.product_recipe_lines, public.production_runs from anon, authenticated;

grant select, delete on public.product_recipe_lines to authenticated;
grant insert (product_id, raw_variant_id, raw_product_id, size_id, quantity),
      update (quantity)
  on public.product_recipe_lines to authenticated;
grant select on public.production_runs to authenticated;

-- Staff ya no inserta producción directo en stock_movements: va por register_production.
drop policy "stock_movements: staff registra compras y producción" on public.stock_movements;

revoke execute on function
  public.product_recipe_lines_validate(),
  public.stock_movements_guard_production(),
  public.consume_recipe(uuid, uuid, numeric, timestamptz, text),
  public.consume_for_sale_item(uuid)
from public, anon, authenticated;

revoke execute on function
  public.recipe_requirements(uuid, numeric, boolean),
  public.register_production(uuid, numeric, numeric, text, timestamptz),
  public.product_margins()
from public, anon;

grant execute on function
  public.recipe_requirements(uuid, numeric, boolean),
  public.register_production(uuid, numeric, numeric, text, timestamptz),
  public.product_margins()
to authenticated;
