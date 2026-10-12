-- Envíos: fecha en que se va a enviar (delivery o envío nacional) y número de guía de la empresa
-- de envíos (MRW, Zoom, Tealca…), que solo existe después de dejar el paquete.
-- · Cualquiera del equipo los anota o cambia con set_sale_shipping; cada cambio queda en el
--   historial de la venta (sale_edits).
-- · No mueven dinero ni inventario. Una venta que retira no lleva envío.

alter table public.sales
  add column ship_date date,
  add column tracking_number text check (tracking_number is null or length(trim(tracking_number)) between 1 and 60);

alter table public.sales add constraint sales_shipping_needs_delivery
  check (delivery_method <> 'pickup' or (ship_date is null and tracking_number is null)) not valid;

-- La venta: además de sus datos, solo cambian los del envío (y solo desde sus funciones).
create or replace function public.sales_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_editable text[] := array['customer_id', 'channel', 'delivery_method', 'notes', 'ship_date', 'tracking_number'];
begin
  if coalesce(current_setting('app.editing_sale', true), '') <> old.id::text
     or (to_jsonb(new) - v_editable) is distinct from (to_jsonb(old) - v_editable) then
    raise exception 'Los registros de sales no se editan ni se borran: se corrigen con un reverso.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create or replace function public.set_sale_shipping(p_sale_id uuid, p_ship_date date, p_tracking_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_tracking text := nullif(trim(p_tracking_number), '');
  v_changes jsonb := '[]';
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if exists (select 1 from public.sale_voids where sale_id = p_sale_id) then
    raise exception 'La venta está anulada.';
  end if;
  if v_sale.delivery_method = 'pickup' and (p_ship_date is not null or v_tracking is not null) then
    raise exception 'La venta es para retirar: no lleva envío.';
  end if;
  if p_ship_date is not null and p_ship_date < (v_sale.occurred_at at time zone 'America/Caracas')::date then
    raise exception 'La fecha de envío no puede ser anterior a la venta.';
  end if;
  if length(v_tracking) > 60 then
    raise exception 'El número de guía va hasta 60 caracteres.';
  end if;

  if p_ship_date is distinct from v_sale.ship_date then
    v_changes := v_changes || jsonb_build_object('field', 'ship_date', 'from', v_sale.ship_date, 'to', p_ship_date);
  end if;
  if v_tracking is distinct from v_sale.tracking_number then
    v_changes := v_changes || jsonb_build_object('field', 'tracking_number', 'from', v_sale.tracking_number, 'to', v_tracking);
  end if;
  if jsonb_array_length(v_changes) = 0 then
    return;
  end if;

  perform set_config('app.editing_sale', p_sale_id::text, true);
  update public.sales set ship_date = p_ship_date, tracking_number = v_tracking where id = p_sale_id;
  perform set_config('app.editing_sale', '', true);

  insert into public.sale_edits (sale_id, reason, changes) values (p_sale_id, 'Datos del envío', v_changes);
end;
$$;

revoke all on function public.set_sale_shipping(uuid, date, text) from public, anon;
grant execute on function public.set_sale_shipping(uuid, date, text) to authenticated;
