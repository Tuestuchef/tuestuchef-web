-- Productos y stock. Modelo en docs/modelo-de-datos.md (sección 2).
-- - Un producto es el modelo; las variantes son color × talla (ambos opcionales).
-- - Precio por producto y método de pago, en USD de referencia (nunca un precio fijo en Bs).
-- - Stock solo por movimientos (inmutables); el saldo es una vista. Stock negativo bloqueado.
-- - SKU único, editable hasta que la variante tenga movimientos.
-- - Staff registra compras y producción; ajustes y carga inicial son de owner y admin.

-- ============================================================
-- Tipos
-- ============================================================

create type public.product_kind as enum ('finished_good', 'raw_material');
create type public.fulfillment_type as enum ('stock', 'made_to_order', 'both');
create type public.product_unit as enum ('unit', 'meter', 'kg');
create type public.product_gender as enum ('women', 'men', 'unisex');
create type public.product_closure as enum ('snap', 'zipper', 'buttons');
create type public.product_fit as enum ('jogger', 'straight');
create type public.stock_movement_type as enum (
  'initial_count',
  'purchase',
  'production',
  'adjustment',
  'sale',
  'sale_reversal'
);

-- ============================================================
-- Listas editables: categorías de producto, tallas y colores
-- (el código se usa en el SKU)
-- ============================================================

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9]{1,6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9]{1,6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9]{1,6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- Tallas de partida (editables en configuración).
insert into public.sizes (name, code, sort_order) values
  ('XS', 'XS', 1), ('S', 'S', 2), ('M', 'M', 3), ('L', 'L', 4), ('XL', 'XL', 5), ('XXL', 'XXL', 6);

-- ============================================================
-- Productos y variantes
-- ============================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories (id),
  name text not null check (length(trim(name)) > 0),
  description text,
  kind public.product_kind not null default 'finished_good',
  fulfillment_type public.fulfillment_type not null default 'stock',
  unit public.product_unit not null default 'unit',
  gender public.product_gender,
  closure public.product_closure,
  fit public.product_fit,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  color_id uuid references public.colors (id),
  size_id uuid references public.sizes (id),
  sku text not null unique check (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  unit_cost_usdt numeric(20, 6) check (unit_cost_usdt is null or unit_cost_usdt >= 0),
  min_stock numeric(12, 3) not null default 0 check (min_stock >= 0),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint product_variants_unique_combo unique nulls not distinct (product_id, color_id, size_id)
);

create index product_variants_product_idx on public.product_variants (product_id);

-- Precio por producto y método de pago, en USD de referencia.
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  payment_method_id uuid not null references public.payment_methods (id),
  amount_usd numeric(20, 2) not null check (amount_usd > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint product_prices_unique unique (product_id, payment_method_id)
);

-- Fotos en el bucket público. Solo la ruta, nunca la URL.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  path text not null unique check (path ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  color_id uuid references public.colors (id),
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create unique index product_images_one_primary on public.product_images (product_id) where is_primary;
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Auditoría de catálogos.
do $$
declare
  t text;
begin
  foreach t in array array['product_categories', 'sizes', 'colors', 'products', 'product_variants', 'product_prices', 'product_images']
  loop
    execute format('create trigger %1$s_created_audit before insert on public.%1$s for each row execute function public.set_created_audit()', t);
    execute format('create trigger %1$s_updated_audit before update on public.%1$s for each row execute function public.set_updated_audit()', t);
  end loop;
end;
$$;

-- ============================================================
-- Movimientos de stock (inmutables)
-- ============================================================

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id),
  movement_type public.stock_movement_type not null,
  -- Con signo: + entra, − sale.
  quantity numeric(12, 3) not null check (quantity <> 0),
  unit_cost_usdt numeric(20, 6) check (unit_cost_usdt is null or unit_cost_usdt >= 0),
  note text,
  -- Lo usará el módulo de ventas (sale / sale_reversal).
  sale_item_id uuid,
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index stock_movements_variant_idx on public.stock_movements (variant_id, occurred_at desc);

create function public.stock_movements_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.product_variants;
  v_product public.products;
  v_balance numeric;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();

  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'La fecha del movimiento no puede ser futura.';
  end if;

  -- Bloquea la variante: dos movimientos simultáneos no pueden dejar el stock negativo.
  select * into v_variant from public.product_variants where id = new.variant_id for update;
  if not found then
    raise exception 'La variante no existe.';
  end if;
  select * into v_product from public.products where id = v_variant.product_id;

  if new.movement_type not in ('sale', 'sale_reversal') then
    if not v_variant.is_active or not v_product.is_active then
      raise exception 'El producto o la variante están inactivos.';
    end if;
  end if;

  if v_product.fulfillment_type = 'made_to_order' then
    raise exception '"%" se hace solo por encargo: no lleva stock.', v_product.name;
  end if;

  if new.movement_type in ('sale', 'sale_reversal')
     and coalesce(current_setting('app.creating_sale', true), '') = '' then
    raise exception 'Las salidas por venta se registran desde el módulo de ventas.';
  end if;

  -- Signo según el tipo.
  if (new.movement_type in ('initial_count', 'purchase', 'production', 'sale_reversal') and new.quantity < 0)
     or (new.movement_type = 'sale' and new.quantity > 0) then
    raise exception 'Cantidad inválida para un movimiento de tipo %.', new.movement_type;
  end if;

  if new.movement_type in ('purchase', 'production') and new.unit_cost_usdt is null then
    raise exception 'Indica el costo unitario.';
  end if;

  if new.movement_type = 'adjustment' and coalesce(trim(new.note), '') = '' then
    raise exception 'Indica el motivo del ajuste.';
  end if;

  if new.movement_type = 'initial_count'
     and exists (select 1 from public.stock_movements where variant_id = new.variant_id) then
    raise exception 'La variante % ya tiene movimientos: usa un ajuste.', v_variant.sku;
  end if;

  select coalesce(sum(quantity), 0) into v_balance from public.stock_movements where variant_id = new.variant_id;
  if v_balance + new.quantity < 0 then
    raise exception 'Stock insuficiente de %: hay %, se piden %.', v_variant.sku, v_balance, -new.quantity;
  end if;

  return new;
end;
$$;

create trigger stock_movements_before_insert
before insert on public.stock_movements
for each row execute function public.stock_movements_before_insert();

-- El costo de la última compra o producción queda como costo de referencia de la variante.
create function public.stock_movements_update_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.movement_type in ('purchase', 'production', 'initial_count') and new.unit_cost_usdt is not null then
    update public.product_variants set unit_cost_usdt = new.unit_cost_usdt where id = new.variant_id;
  end if;
  return null;
end;
$$;

create trigger stock_movements_update_cost
after insert on public.stock_movements
for each row execute function public.stock_movements_update_cost();

create trigger stock_movements_immutable
before update or delete on public.stock_movements
for each row execute function public.prevent_mutation();

create trigger stock_movements_no_truncate
before truncate on public.stock_movements
for each statement execute function public.prevent_mutation();

-- SKU, color y talla no cambian una vez que la variante tiene movimientos.
create function public.product_variants_guard_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.sku is distinct from old.sku
      or new.color_id is distinct from old.color_id
      or new.size_id is distinct from old.size_id
      or new.product_id is distinct from old.product_id)
     and exists (select 1 from public.stock_movements where variant_id = old.id) then
    raise exception 'La variante % ya tiene movimientos de stock: su SKU, color y talla no se pueden cambiar.', old.sku;
  end if;
  return new;
end;
$$;

create trigger product_variants_guard_identity
before update on public.product_variants
for each row execute function public.product_variants_guard_identity();

-- ============================================================
-- Saldos
-- ============================================================

create view public.stock_balances
with (security_invoker = true)
as
select
  v.id as variant_id,
  v.product_id,
  v.sku,
  v.min_stock,
  coalesce(sum(m.quantity), 0)::numeric(12, 3) as quantity,
  (v.min_stock > 0 and coalesce(sum(m.quantity), 0) <= v.min_stock) as is_low,
  max(m.occurred_at) as last_movement_at
from public.product_variants v
left join public.stock_movements m on m.variant_id = v.id
group by v.id;

-- ============================================================
-- Carga inicial en lote (CSV ya validado en el servidor). Todo o nada.
-- ============================================================

create function public.load_initial_stock(p_rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_variant_id uuid;
  v_count integer := 0;
begin
  for v_row in select * from jsonb_array_elements(p_rows) loop
    select id into v_variant_id from public.product_variants where sku = upper(trim(v_row ->> 'sku'));
    if v_variant_id is null then
      raise exception 'SKU no encontrado: %', v_row ->> 'sku';
    end if;
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, note)
    values (
      v_variant_id,
      'initial_count',
      (v_row ->> 'quantity')::numeric,
      nullif(v_row ->> 'unit_cost_usdt', '')::numeric,
      'Carga inicial (CSV)'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['product_categories', 'sizes', 'colors', 'products', 'product_variants', 'product_prices', 'product_images']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: todo el equipo los ve" on public.%1$s for select to authenticated using (public.has_role(array[''owner'', ''admin'', ''staff'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin crean" on public.%1$s for insert to authenticated with check (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
    execute format(
      'create policy "%1$s: owner y admin editan" on public.%1$s for update to authenticated using (public.has_role(array[''owner'', ''admin'']::public.app_role[])) with check (public.has_role(array[''owner'', ''admin'']::public.app_role[]))', t);
  end loop;
end;
$$;

-- Fotos y precios no son registros contables: se pueden quitar.
create policy "product_images: owner y admin borran"
on public.product_images for delete
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "product_prices: owner y admin borran"
on public.product_prices for delete
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

alter table public.stock_movements enable row level security;

create policy "stock_movements: todo el equipo los ve"
on public.stock_movements for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "stock_movements: owner y admin registran"
on public.stock_movements for insert
to authenticated
with check (public.has_role(array['owner', 'admin']::public.app_role[]));

-- Staff: solo compras y producción.
create policy "stock_movements: staff registra compras y producción"
on public.stock_movements for insert
to authenticated
with check (
  public.has_role(array['staff']::public.app_role[])
  and movement_type in ('purchase', 'production')
);

-- ============================================================
-- Permisos
-- ============================================================

revoke all on table
  public.product_categories, public.sizes, public.colors, public.products, public.product_variants,
  public.product_prices, public.product_images, public.stock_movements, public.stock_balances
from anon, authenticated;

grant select on public.product_categories, public.sizes, public.colors to authenticated;
grant insert (name, code, sort_order, is_active), update (name, code, sort_order, is_active)
  on public.product_categories, public.sizes, public.colors to authenticated;

grant select on public.products to authenticated;
grant insert (category_id, name, description, kind, fulfillment_type, unit, gender, closure, fit, is_active),
      update (category_id, name, description, fulfillment_type, unit, gender, closure, fit, is_active)
  on public.products to authenticated;

grant select on public.product_variants to authenticated;
grant insert (product_id, color_id, size_id, sku, unit_cost_usdt, min_stock, is_active),
      update (color_id, size_id, sku, unit_cost_usdt, min_stock, is_active)
  on public.product_variants to authenticated;

grant select, delete on public.product_prices to authenticated;
-- El upsert de la API reescribe también las columnas clave: necesitan permiso de update.
grant insert (product_id, payment_method_id, amount_usd), update (product_id, payment_method_id, amount_usd)
  on public.product_prices to authenticated;

grant select, delete on public.product_images to authenticated;
grant insert (product_id, path, color_id, sort_order, is_primary), update (color_id, sort_order, is_primary)
  on public.product_images to authenticated;

grant select on public.stock_movements to authenticated;
grant insert (variant_id, movement_type, quantity, unit_cost_usdt, note, occurred_at) on public.stock_movements to authenticated;
grant select on public.stock_balances to authenticated;

revoke execute on function
  public.stock_movements_before_insert(),
  public.stock_movements_update_cost(),
  public.product_variants_guard_identity()
from public, anon, authenticated;

revoke execute on function public.load_initial_stock(jsonb) from public, anon;
grant execute on function public.load_initial_stock(jsonb) to authenticated;
