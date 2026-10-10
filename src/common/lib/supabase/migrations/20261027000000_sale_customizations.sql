-- Personalización en ventas rápidas: qué se le hizo a cada pieza (nombre bordado, logo…), con el
-- texto o el nombre del logo y, si se quiere, el archivo.
-- · Cobrarla es opcional por personalización: cobrada suma el precio del tipo (con su descuento al
--   mayor); sin cobrar solo queda anotada (p. ej. si ya iba incluida en el precio).
-- · En ventas no aplica el mínimo de piezas del tipo ni el archivo de logo obligatorio (eso es de pedidos).
-- · Va en productos sueltos, no en combos (como en pedidos).
-- · Las ventas sin conexión la llevan igual.

-- ============================================================
-- Cobrada o solo anotada
-- ============================================================

alter table public.sale_item_customizations add column charged boolean not null default true;
alter table public.sale_item_customizations drop constraint sale_item_customizations_unit_price_usd_check;
alter table public.sale_item_customizations add constraint sale_item_customizations_price_valid check (
  case when charged then unit_price_usd > 0 else unit_price_usd = 0 and line_total_usd = 0 end
);

-- ============================================================
-- Validar y poner precio a la personalización de una venta
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
  v_custom jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_type public.customization_types;
  v_qty numeric;
  v_custom_qty numeric;
  v_names jsonb;
  v_totals jsonb := '{}';
  v_extra numeric := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_array_length(coalesce(v_item -> 'customizations', '[]')) = 0 then
      continue;
    end if;
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    select * into v_product from public.products where id = v_variant.product_id;
    if v_product.kind = 'combo' then
      raise exception 'La personalización va en productos sueltos, no en combos.';
    end if;
    v_qty := (v_item ->> 'quantity')::numeric;

    for v_custom in select * from jsonb_array_elements(v_item -> 'customizations') loop
      select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
      if not found or not v_type.is_active then
        raise exception 'Una personalización no existe o está inactiva.';
      end if;
      v_custom_qty := coalesce((v_custom ->> 'quantity')::numeric, v_qty);
      if v_custom_qty <= 0 or v_custom_qty > v_qty or v_custom_qty <> trunc(v_custom_qty) then
        raise exception '"%": las piezas van de 1 a las de la línea.', v_type.name;
      end if;
      if v_type.max_size_cm is not null and (v_custom ->> 'size_cm')::numeric > v_type.max_size_cm then
        raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
      end if;
      v_names := coalesce(v_custom -> 'names', '[]');
      if coalesce(trim(v_custom ->> 'text'), '') = '' and jsonb_array_length(v_names) = 0
         and coalesce(v_custom ->> 'logo_path', '') = '' then
        raise exception '"%": escribe el nombre, el texto o qué logo lleva.', v_type.name;
      end if;
      if jsonb_array_length(v_names) > 0 and jsonb_array_length(v_names) <> v_custom_qty then
        raise exception '"%": van % nombres para % piezas.', v_type.name, jsonb_array_length(v_names), trim_scale(v_custom_qty);
      end if;
      if coalesce((v_custom ->> 'charged')::boolean, true) then
        if v_type.unit_price_usd is null then
          raise exception '"%" todavía no tiene precio: anótala sin cobrar u owner o admin debe cargarlo.', v_type.name;
        end if;
        v_totals := v_totals || jsonb_build_object(
          v_type.id::text, coalesce((v_totals ->> v_type.id::text)::numeric, 0) + v_custom_qty
        );
      end if;
    end loop;
  end loop;

  -- Lo cobrado, por tipo, con su descuento al mayor.
  for v_type in select * from public.customization_types where v_totals ? id::text loop
    v_custom_qty := (v_totals ->> v_type.id::text)::numeric;
    v_extra := v_extra + round(
      v_custom_qty * v_type.unit_price_usd * (1 - public.volume_discount_percent('customization', v_custom_qty) / 100), 2
    );
  end loop;

  return jsonb_build_object('totals', v_totals, 'extra', v_extra);
end;
$$;

-- Guarda la personalización de cada línea (p_ids: las líneas creadas, en el orden de p_items).
create or replace function public.sale_customizations_insert(p_items jsonb, p_ids jsonb, p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_custom jsonb;
  v_type public.customization_types;
  v_custom_qty numeric;
  v_charged boolean;
  v_percent numeric;
  v_custom_id uuid;
  v_name jsonb;
  v_ord integer;
  v_index integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
      select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
      v_custom_qty := coalesce((v_custom ->> 'quantity')::numeric, (v_item ->> 'quantity')::numeric);
      v_charged := coalesce((v_custom ->> 'charged')::boolean, true);
      v_percent := case when v_charged
                        then public.volume_discount_percent('customization', (p_totals ->> v_type.id::text)::numeric)
                        else 0 end;
      insert into public.sale_item_customizations
        (sale_item_id, customization_type_id, quantity, text, logo_path, position, size_cm, note,
         charged, unit_price_usd, discount_percent, line_total_usd)
      values (
        (p_ids ->> v_index)::uuid, v_type.id, v_custom_qty,
        nullif(trim(v_custom ->> 'text'), ''), nullif(v_custom ->> 'logo_path', ''),
        nullif(trim(v_custom ->> 'position'), ''), (v_custom ->> 'size_cm')::numeric, nullif(trim(v_custom ->> 'note'), ''),
        v_charged,
        case when v_charged then v_type.unit_price_usd else 0 end,
        v_percent,
        case when v_charged then round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2) else 0 end
      )
      returning id into v_custom_id;
      v_ord := 0;
      for v_name in select * from jsonb_array_elements(coalesce(v_custom -> 'names', '[]')) loop
        v_ord := v_ord + 1;
        insert into public.sale_item_customization_names (customization_id, ordinal, name)
        values (v_custom_id, v_ord, trim(v_name #>> '{}'));
      end loop;
    end loop;
    v_index := v_index + 1;
  end loop;
end;
$$;

-- ============================================================
-- Venta rápida (en línea y sin conexión) con personalización
-- ============================================================

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
  v_check jsonb;
  v_sale_id uuid;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar ventas.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where coalesce((i ->> 'reserved_quantity')::numeric, 0) > 0
       or exists (select 1 from jsonb_array_elements(coalesce(i -> 'components', '[]')) c
                  where coalesce((c ->> 'reserved_quantity')::numeric, 0) > 0)
  ) then
    raise exception 'Apartar piezas del inventario es solo para pedidos.';
  end if;

  -- La personalización cobrada entra en el total antes de que se apliquen los pagos.
  v_check := public.sale_customizations_check(p_items);
  v_sale_id := public.create_sale_core(
    p_channel, p_price_method_id, p_delivery_method, p_items, p_payments, p_customer_id,
    p_delivery_fee_usd, p_discount_type, p_discount_value, p_discount_reason, p_notes, p_delivered,
    p_occurred_at, (v_check ->> 'extra')::numeric, false
  );
  perform public.sale_customizations_insert(
    p_items, current_setting('app.last_sale_item_ids', true)::jsonb, v_check -> 'totals'
  );
  return v_sale_id;
end;
$$;

-- Sin conexión: igual que la venta en línea (antes iba directo al núcleo, sin personalización).
create or replace function public.sync_offline_sale(p_client_ref uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_at timestamptz;
  v_error text;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar ventas.' using errcode = '42501';
  end if;
  if p_client_ref is null or p_payload is null then
    raise exception 'Venta sin conexión inválida.';
  end if;

  -- Ya registrada (reenvío): se devuelve la misma.
  select sale_id into v_sale_id from public.offline_sale_refs where client_ref = p_client_ref;
  if found then
    return jsonb_build_object('status', 'duplicate', 'sale_id', v_sale_id);
  end if;
  v_at := coalesce((p_payload ->> 'occurred_at')::timestamptz, now());

  begin
    v_sale_id := public.create_sale(
      (p_payload ->> 'channel')::public.sale_channel,
      (p_payload ->> 'price_method_id')::uuid,
      (p_payload ->> 'delivery_method')::public.delivery_method,
      p_payload -> 'items',
      coalesce(p_payload -> 'payments', '[]'),
      nullif(p_payload ->> 'customer_id', '')::uuid,
      coalesce((p_payload ->> 'delivery_fee_usd')::numeric, 0),
      nullif(p_payload ->> 'discount_type', '')::public.discount_type,
      (p_payload ->> 'discount_value')::numeric,
      nullif(p_payload ->> 'discount_reason', ''),
      nullif(p_payload ->> 'notes', ''),
      coalesce((p_payload ->> 'delivered')::boolean, false),
      v_at
    );
    insert into public.offline_sale_refs (client_ref, sale_id) values (p_client_ref, v_sale_id);
  exception when others then
    -- La venta no se hizo (se deshace) pero queda guardada para revisión.
    get stacked diagnostics v_error = message_text;
    perform set_config('app.offline_sync', p_client_ref::text, true);
    insert into public.offline_sale_rejections (client_ref, payload, error, occurred_at)
    values (p_client_ref, p_payload, left(v_error, 500), v_at)
    on conflict (client_ref) do update
      set attempts = public.offline_sale_rejections.attempts + 1, error = excluded.error
      where public.offline_sale_rejections.resolved_at is null;
    perform set_config('app.offline_sync', '', true);
    return jsonb_build_object('status', 'rejected', 'error', v_error);
  end;

  -- Si había quedado pendiente y ahora pasó (reintento), se marca resuelta.
  if exists (select 1 from public.offline_sale_rejections where client_ref = p_client_ref and resolved_at is null) then
    perform set_config('app.offline_sync', p_client_ref::text, true);
    update public.offline_sale_rejections
    set resolved_at = now(), resolved_by = auth.uid(), resolved_sale_id = v_sale_id
    where client_ref = p_client_ref;
    perform set_config('app.offline_sync', '', true);
  end if;

  return jsonb_build_object('status', 'created', 'sale_id', v_sale_id);
end;
$$;

-- ============================================================
-- Permisos
-- ============================================================

revoke all on function
  public.sale_customizations_check(jsonb),
  public.sale_customizations_insert(jsonb, jsonb, jsonb)
from public, anon, authenticated;
