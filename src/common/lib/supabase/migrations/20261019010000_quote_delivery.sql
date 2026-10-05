-- Presupuestos, paso 5: envío por correo y WhatsApp, y enlace público para ver el PDF.
--
-- · Cada envío queda en outbound_messages (Mensajes enviados) con su presupuesto y canal.
-- · El texto de WhatsApp es una plantilla editable más (Configuración → Mensajes).
-- · Enlace público /p/presupuesto/<token>: lo resuelve el servidor con la clave de servicio
--   (nadie anónimo lee tablas). Funciona hasta 30 días después del vencimiento, se puede
--   revocar, tiene límite de solicitudes y cada apertura queda registrada (se ve en el detalle).

alter table public.outbound_messages
  add column quote_id uuid references public.quotes (id),
  add column email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
create index outbound_messages_quote_idx on public.outbound_messages (quote_id, created_at desc);

-- El guardián compara también las columnas nuevas: de un mensaje enviado solo cambia su estado.
create or replace function public.outbound_messages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los mensajes enviados no se borran.' using errcode = 'restrict_violation';
  end if;
  if (new.kind, new.channel, new.customer_id, new.sale_id, new.quote_id, new.phone, new.email, new.body, new.created_by, new.created_at)
     is distinct from (old.kind, old.channel, old.customer_id, old.sale_id, old.quote_id, old.phone, old.email, old.body, old.created_by, old.created_at) then
    raise exception 'De un mensaje enviado solo cambia su estado.' using errcode = 'restrict_violation';
  end if;
  new.status_updated_at := now();
  return new;
end;
$$;

insert into public.message_templates (kind, name, body) values
  ('quote', 'Presupuesto',
   E'Hola {cliente} 👋 Te enviamos el presupuesto {numero} de *{negocio}* por *{total}*, válido hasta el {vence}.\n\nPuedes verlo aquí: {enlace}\n\nCualquier duda, escríbenos por aquí.');

-- Registra un envío de presupuesto (correo o WhatsApp). Cualquier rol; el presupuesto debe
-- estar enviado (o aceptado/rechazado: se puede reenviar). WhatsApp necesita su plantilla prendida.
create or replace function public.log_quote_message(
  p_quote_id uuid,
  p_channel public.message_channel,
  p_body text,
  p_phone text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_id uuid;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'No tienes permiso para enviar presupuestos.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then
    raise exception 'El presupuesto no existe.';
  end if;
  if v_quote.status not in ('sent', 'accepted', 'rejected') then
    raise exception 'Solo se envía un presupuesto ya enviado (este está %).', v_quote.status;
  end if;
  if p_channel = 'email' and nullif(trim(p_email), '') is null then
    raise exception 'Indica el correo del cliente.';
  end if;
  if p_channel = 'wa_link' and not exists (select 1 from public.message_templates where kind = 'quote' and enabled) then
    raise exception 'El mensaje de presupuesto está apagado en Configuración.' using errcode = 'check_violation';
  end if;

  -- El correo lo envía el servidor (enviado); WhatsApp solo se abre con el texto (abierto).
  insert into public.outbound_messages (kind, channel, status, customer_id, quote_id, phone, email, body, created_by)
  values (
    'quote', p_channel, case when p_channel = 'email' then 'sent' else 'opened' end::public.message_status,
    v_quote.customer_id, p_quote_id, nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''), p_body, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Aperturas del enlace público (también sirven para el límite de solicitudes).
create table public.quote_link_views (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes (id),
  -- Huella de la IP (hash), no la IP: basta para limitar solicitudes.
  ip_hash text not null check (length(ip_hash) between 8 and 128),
  allowed boolean not null,
  created_at timestamptz not null default now()
);
create index quote_link_views_quote_idx on public.quote_link_views (quote_id, created_at desc);
create index quote_link_views_ip_idx on public.quote_link_views (ip_hash, created_at desc);

-- Resuelve un token del enlace público. Solo el servidor (clave de servicio).
-- Límites: 30 solicitudes por IP cada 10 minutos y 120 por enlace cada hora.
create or replace function public.quote_public_lookup(p_token text, p_ip_hash text)
returns table (quote_id uuid, code text, pdf_path text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_outcome text;
begin
  -- Limpieza: las aperturas de más de 7 días ya no hacen falta para el límite.
  delete from public.quote_link_views where created_at < now() - interval '7 days' and not allowed;

  if (select count(*) from public.quote_link_views where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 30 then
    insert into public.quote_link_views (quote_id, ip_hash, allowed) values (null, p_ip_hash, false);
    return query select null::uuid, null::text, null::text, 'rate_limited'::text;
    return;
  end if;

  select * into v_quote from public.quotes q where q.public_token = p_token and p_token ~ '^[0-9a-f]{64}$';
  if not found then
    v_outcome := 'not_found';
  elsif (select count(*) from public.quote_link_views v where v.quote_id = v_quote.id and v.created_at > now() - interval '1 hour') >= 120 then
    v_outcome := 'rate_limited';
  elsif v_quote.token_revoked_at is not null then
    v_outcome := 'revoked';
  elsif v_quote.status = 'superseded' then
    v_outcome := 'superseded';
  elsif v_quote.status not in ('sent', 'accepted', 'rejected', 'expired') then
    v_outcome := 'not_found';
  elsif v_quote.valid_until + 30 < public.caracas_today() then
    v_outcome := 'link_expired';
  else
    v_outcome := 'ok';
  end if;

  insert into public.quote_link_views (quote_id, ip_hash, allowed) values (v_quote.id, p_ip_hash, v_outcome = 'ok');
  return query select
    case when v_outcome = 'ok' then v_quote.id end,
    case when v_outcome = 'ok' then v_quote.code end,
    case when v_outcome = 'ok' then v_quote.pdf_path end,
    v_outcome;
end;
$$;

-- Cortar el enlace público de un presupuesto (p. ej. se mandó a quien no era).
create or replace function public.revoke_quote_link(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  update public.quotes set token_revoked_at = now()
  where id = p_quote_id and public_token is not null and token_revoked_at is null;
  if not found then
    raise exception 'Ese presupuesto no tiene un enlace activo.';
  end if;
end;
$$;

alter table public.quote_link_views enable row level security;
create policy "quote_link_views: todo el equipo las ve" on public.quote_link_views for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
revoke all on table public.quote_link_views from anon, authenticated;
grant select on table public.quote_link_views to authenticated;

revoke all on function public.log_quote_message(uuid, public.message_channel, text, text, text) from public, anon;
grant execute on function public.log_quote_message(uuid, public.message_channel, text, text, text) to authenticated;
revoke all on function public.revoke_quote_link(uuid) from public, anon;
grant execute on function public.revoke_quote_link(uuid) to authenticated;
revoke all on function public.quote_public_lookup(text, text) from public, anon, authenticated;
grant execute on function public.quote_public_lookup(text, text) to service_role;
