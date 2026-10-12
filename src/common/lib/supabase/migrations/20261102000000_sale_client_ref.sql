-- Una venta no se registra dos veces: el teléfono le pone un identificador (client_ref) desde el
-- primer intento. Si se cae la señal justo al registrar y la venta pasa a la cola sin conexión,
-- al reenviarla con el mismo identificador se devuelve la que ya existe (offline_sale_refs).

-- p_payload: los mismos campos que sync_offline_sale.
create or replace function public.create_sale_once(p_client_ref uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar ventas.' using errcode = '42501';
  end if;
  if p_client_ref is null or p_payload is null then
    raise exception 'Venta inválida.';
  end if;

  -- Dos envíos simultáneos de la misma venta: el segundo espera al primero.
  perform pg_advisory_xact_lock(hashtextextended(p_client_ref::text, 0));
  select sale_id into v_sale_id from public.offline_sale_refs where client_ref = p_client_ref;
  if found then
    return v_sale_id;
  end if;

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
    (p_payload ->> 'occurred_at')::timestamptz
  );
  insert into public.offline_sale_refs (client_ref, sale_id) values (p_client_ref, v_sale_id);
  return v_sale_id;
end;
$$;

-- Sin conexión: también espera a un envío en curso de la misma venta antes de mirar si ya existe.
create or replace function public.sync_offline_sale_locked(p_client_ref uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_client_ref::text, 0));
  return public.sync_offline_sale(p_client_ref, p_payload);
end;
$$;

revoke all on function public.create_sale_once(uuid, jsonb), public.sync_offline_sale_locked(uuid, jsonb) from public, anon;
grant execute on function public.create_sale_once(uuid, jsonb), public.sync_offline_sale_locked(uuid, jsonb) to authenticated;
