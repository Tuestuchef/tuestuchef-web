-- Fase 3, paso 5: ventas sin conexión.
--
-- El teléfono guarda la venta con un id propio (client_ref) y la manda al volver la señal.
-- La base la valida igual que una venta normal (stock, cliente bloqueado, tasa de esa fecha,
-- días hacia atrás de staff) con la fecha y hora en que de verdad se hizo.
--   · Reenviar la misma venta nunca la duplica (offline_sale_refs).
--   · Si no pasa, queda guardada con todo su contenido y el motivo (offline_sale_rejections):
--     nunca se pierde. Owner o admin la reintentan o la descartan.

-- Ventas ya registradas desde un teléfono sin conexión.
create table public.offline_sale_refs (
  client_ref uuid primary key,
  sale_id uuid not null unique references public.sales (id),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Ventas que no pasaron al sincronizar.
create table public.offline_sale_rejections (
  id uuid primary key default gen_random_uuid(),
  client_ref uuid not null unique,
  payload jsonb not null,
  error text not null,
  -- Cuándo se hizo la venta en el teléfono.
  occurred_at timestamptz not null,
  attempts integer not null default 1 check (attempts >= 1),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Resolución: registrada (con su venta) o descartada (con motivo).
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  resolved_sale_id uuid references public.sales (id),
  resolution_note text check (resolution_note is null or length(resolution_note) <= 300),
  constraint offline_sale_rejections_resolution check (
    (resolved_at is null and resolved_by is null and resolved_sale_id is null)
    or (resolved_at is not null and resolved_by is not null and (resolved_sale_id is not null or resolution_note is not null))
  )
);
create index offline_sale_rejections_open_idx on public.offline_sale_rejections (created_at desc) where resolved_at is null;

create trigger offline_sale_refs_immutable before update or delete on public.offline_sale_refs
  for each row execute function public.prevent_mutation();
create trigger offline_sale_rejections_no_delete before delete on public.offline_sale_rejections
  for each row execute function public.prevent_mutation();

-- Solo cambian intentos y resolución, desde sus funciones.
create or replace function public.offline_sale_rejections_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.offline_sync', true), '') <> old.client_ref::text then
    raise exception 'Una venta pendiente se reintenta o se descarta desde su pantalla.';
  end if;
  if new.client_ref is distinct from old.client_ref or new.payload is distinct from old.payload
     or new.created_by is distinct from old.created_by or new.occurred_at is distinct from old.occurred_at then
    raise exception 'El contenido de una venta pendiente no se cambia.';
  end if;
  if old.resolved_at is not null then
    raise exception 'Esta venta pendiente ya se resolvió.';
  end if;
  return new;
end;
$$;

create trigger offline_sale_rejections_guard_update before update on public.offline_sale_rejections
  for each row execute function public.offline_sale_rejections_guard_update();

-- Registra una venta hecha sin conexión. Devuelve {status: created | duplicate | rejected, sale_id, error}.
-- p_payload: los mismos campos que create_sale (channel, price_method_id, delivery_method, items,
-- payments, customer_id, delivery_fee_usd, discount_*, notes, delivered) + occurred_at (ISO).
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
  -- Ya rechazada antes y sin resolver: se cuenta el intento y se reintenta.
  v_at := coalesce((p_payload ->> 'occurred_at')::timestamptz, now());

  begin
    v_sale_id := public.create_sale_core(
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
      v_at,
      0,
      false
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

-- Reintentar una venta pendiente: owner y admin (sin el límite de días de staff).
create or replace function public.retry_offline_sale(p_rejection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.offline_sale_rejections;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin reintentan ventas pendientes.' using errcode = '42501';
  end if;
  select * into v_row from public.offline_sale_rejections where id = p_rejection_id;
  if not found or v_row.resolved_at is not null then
    raise exception 'La venta pendiente no existe o ya se resolvió.';
  end if;
  return public.sync_offline_sale(v_row.client_ref, v_row.payload);
end;
$$;

-- Descartar una venta pendiente (p. ej. ya se registró a mano): owner y admin, con motivo.
create or replace function public.discard_offline_sale(p_rejection_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.offline_sale_rejections;
begin
  if not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin descartan ventas pendientes.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo.';
  end if;
  select * into v_row from public.offline_sale_rejections where id = p_rejection_id;
  if not found or v_row.resolved_at is not null then
    raise exception 'La venta pendiente no existe o ya se resolvió.';
  end if;
  perform set_config('app.offline_sync', v_row.client_ref::text, true);
  update public.offline_sale_rejections
  set resolved_at = now(), resolved_by = auth.uid(), resolution_note = trim(p_reason)
  where id = p_rejection_id;
  perform set_config('app.offline_sync', '', true);
end;
$$;

-- RLS: cada quien ve lo suyo; owner y admin, todo.
alter table public.offline_sale_refs enable row level security;
alter table public.offline_sale_rejections enable row level security;
create policy "offline_sale_refs: propias o gestión" on public.offline_sale_refs for select to authenticated
  using (created_by = auth.uid() or public.has_role(array['owner', 'admin']::public.app_role[]));
create policy "offline_sale_rejections: propias o gestión" on public.offline_sale_rejections for select to authenticated
  using (created_by = auth.uid() or public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.offline_sale_refs, public.offline_sale_rejections from anon, authenticated;
grant select on table public.offline_sale_refs, public.offline_sale_rejections to authenticated;

revoke all on function public.offline_sale_rejections_guard_update() from public, anon, authenticated;
revoke all on function
  public.sync_offline_sale(uuid, jsonb),
  public.retry_offline_sale(uuid),
  public.discard_offline_sale(uuid, text)
from public, anon;
grant execute on function
  public.sync_offline_sale(uuid, jsonb),
  public.retry_offline_sale(uuid),
  public.discard_offline_sale(uuid, text)
to authenticated;
