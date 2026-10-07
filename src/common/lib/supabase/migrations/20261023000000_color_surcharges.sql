-- Recargo por color: algunos colores o estampados (p. ej. pata de gallo) cuestan más en ciertos productos.
-- Igual que el recargo por talla: una fila por color y producto, en USD de referencia, sumado en todos los
-- métodos. Si la variante tiene recargo de talla y de color, se suman los dos.
-- No aplica a combos ni a la personalización. Lo ya vendido o presupuestado no cambia.

create table public.color_surcharges (
  color_id uuid not null references public.colors (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  amount_usd numeric(20, 2) not null check (amount_usd > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (color_id, product_id)
);

create index color_surcharges_product_idx on public.color_surcharges (product_id);

create trigger color_surcharges_created_audit before insert on public.color_surcharges
  for each row execute function public.set_created_audit();
create trigger color_surcharges_updated_audit before update on public.color_surcharges
  for each row execute function public.set_updated_audit();

-- Solo productos terminados llevan recargo: la misma regla (y función) para tallas y colores.
create or replace function public.size_surcharges_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select kind from public.products where id = new.product_id) <> 'finished_good' then
    raise exception 'El recargo (por talla o por color) es solo para productos terminados (no combos ni materia prima).';
  end if;
  return new;
end;
$$;

create trigger color_surcharges_guard before insert or update on public.color_surcharges
  for each row execute function public.size_surcharges_guard();

alter table public.color_surcharges enable row level security;

create policy "color_surcharges: todo el equipo los ve" on public.color_surcharges for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "color_surcharges: owner y admin crean" on public.color_surcharges for insert to authenticated
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "color_surcharges: owner y admin editan" on public.color_surcharges for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "color_surcharges: owner y admin quitan" on public.color_surcharges for delete to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.color_surcharges from anon, authenticated;
grant select, delete on public.color_surcharges to authenticated;
grant insert (color_id, product_id, amount_usd), update (color_id, product_id, amount_usd)
  on public.color_surcharges to authenticated;

-- Precio en USD de una variante para un método: el del producto + el recargo de su talla + el de su color.
-- Ventas, pedidos y presupuestos ya lo usan: no hace falta tocar sus motores.
create or replace function public.variant_price_usd(p_variant_id uuid, p_method_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select pp.amount_usd + coalesce(ss.amount_usd, 0) + coalesce(cs.amount_usd, 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  join public.product_prices pp on pp.product_id = v.product_id and pp.payment_method_id = p_method_id
  left join public.size_surcharges ss on ss.product_id = v.product_id and ss.size_id = v.size_id and p.kind = 'finished_good'
  left join public.color_surcharges cs on cs.product_id = v.product_id and cs.color_id = v.color_id and p.kind = 'finished_good'
  where v.id = p_variant_id
$$;

-- ============================================================
-- Margen por variante y método: con el recargo de su talla y de su color.
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
