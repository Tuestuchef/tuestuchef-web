-- Fase 3, paso 6: mensajes de WhatsApp.
--
-- Plantillas editables por owner y admin (texto con datos entre llaves que la app completa) y un
-- registro de cada mensaje enviado. Hoy se envían con enlaces wa.me (la persona toca enviar en
-- WhatsApp); el registro ya tiene canal, estado e id del proveedor para pasar luego a la API de
-- WhatsApp Business sin cambiar las pantallas.

create type public.message_kind as enum ('sale_note', 'payment_reminder', 'order_confirmed', 'order_ready', 'order_cancelled');
create type public.message_channel as enum ('wa_link', 'wa_api');
-- wa_link solo llega a 'opened' (se abrió WhatsApp con el texto). El resto es para la API.
create type public.message_status as enum ('opened', 'queued', 'sent', 'delivered', 'read', 'failed');

create table public.message_templates (
  kind public.message_kind primary key,
  name text not null check (length(trim(name)) between 1 and 80),
  body text not null check (length(trim(body)) between 1 and 2000),
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger message_templates_updated_audit before update on public.message_templates
  for each row execute function public.set_settings_audit();

insert into public.message_templates (kind, name, body) values
  ('sale_note', 'Nota de entrega',
   E'Hola {cliente} 👋\n\n*{negocio}* · Nota de entrega {numero}\n{fecha}\n\n{detalle}\n\n¡Gracias por tu compra!'),
  ('payment_reminder', 'Recordatorio de pago',
   E'Hola {cliente} 👋 Te escribimos de *{negocio}*.\n\nTe recordamos que tienes un saldo pendiente de *{pendiente}*:\n{ventas}\n\nCuando hagas el pago, envíanos el comprobante por aquí. ¡Gracias!'),
  ('order_confirmed', 'Pedido confirmado',
   E'Hola {cliente} 👋 ¡Recibimos tu pedido {numero}!\n\nTotal: {total}\nAbono para empezar: *{abono}* (pagado: {pagado})\nFecha de entrega estimada: *{fecha_entrega}*\n\nTe avisamos por aquí cuando esté listo.'),
  ('order_ready', 'Pedido listo',
   E'Hola {cliente} 👋 ¡Tu pedido {numero} está listo! 🎉\n\nSaldo para entregarlo: *{pendiente}*.\nAvísanos si lo retiras o prefieres delivery.'),
  ('order_cancelled', 'Pedido cancelado',
   E'Hola {cliente}. Confirmamos la cancelación de tu pedido {numero}.\n\nReembolso: *{reembolso}*, en la misma moneda y cuenta en que pagaste.\n\nCualquier duda, escríbenos por aquí.');

-- Cada mensaje enviado: a quién, sobre qué venta, el texto final y en qué quedó.
create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  kind public.message_kind not null,
  channel public.message_channel not null default 'wa_link',
  status public.message_status not null default 'opened',
  customer_id uuid references public.customers (id),
  sale_id uuid references public.sales (id),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  body text not null check (length(body) between 1 and 4096),
  provider_message_id text check (provider_message_id is null or length(provider_message_id) <= 200),
  error text check (error is null or length(error) <= 1000),
  status_updated_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index outbound_messages_sale_idx on public.outbound_messages (sale_id, created_at desc);
create index outbound_messages_customer_idx on public.outbound_messages (customer_id, created_at desc);

-- No se borran. Solo cambian el estado y los datos del proveedor (lo hará la API).
create or replace function public.outbound_messages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los mensajes enviados no se borran.' using errcode = 'restrict_violation';
  end if;
  if (new.kind, new.channel, new.customer_id, new.sale_id, new.phone, new.body, new.created_by, new.created_at)
     is distinct from (old.kind, old.channel, old.customer_id, old.sale_id, old.phone, old.body, old.created_by, old.created_at) then
    raise exception 'De un mensaje enviado solo cambia su estado.' using errcode = 'restrict_violation';
  end if;
  new.status_updated_at := now();
  return new;
end;
$$;

create trigger outbound_messages_guard before update or delete on public.outbound_messages
  for each row execute function public.outbound_messages_guard();

-- Registra un mensaje que se va a abrir en WhatsApp. Cualquier rol; el recordatorio de pago
-- (pantalla Por cobrar) solo owner y admin. La plantilla debe estar prendida.
create or replace function public.log_outbound_message(
  p_kind public.message_kind,
  p_body text,
  p_phone text default null,
  p_customer_id uuid default null,
  p_sale_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := p_customer_id;
  v_id uuid;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'No tienes permiso para enviar mensajes.' using errcode = 'insufficient_privilege';
  end if;
  if p_kind = 'payment_reminder' and not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin envían recordatorios de pago.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.message_templates where kind = p_kind and enabled) then
    raise exception 'Ese mensaje está apagado en Configuración.' using errcode = 'check_violation';
  end if;
  if p_sale_id is not null then
    select coalesce(v_customer, s.customer_id) into v_customer from public.sales s where s.id = p_sale_id;
    if not found then
      raise exception 'La venta no existe.' using errcode = 'no_data_found';
    end if;
  end if;

  insert into public.outbound_messages (kind, customer_id, sale_id, phone, body, created_by)
  values (p_kind, v_customer, p_sale_id, nullif(trim(p_phone), ''), p_body, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Para la API de WhatsApp Business (webhooks): solo el servidor con la clave de servicio.
create or replace function public.set_outbound_message_status(
  p_id uuid,
  p_status public.message_status,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.outbound_messages
  set status = p_status,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      error = p_error
  where id = p_id;
  if not found then
    raise exception 'El mensaje no existe.' using errcode = 'no_data_found';
  end if;
end;
$$;

-- RLS
alter table public.message_templates enable row level security;
alter table public.outbound_messages enable row level security;

create policy "message_templates: todos ven" on public.message_templates for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "message_templates: owner y admin editan" on public.message_templates for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));

create policy "outbound_messages: propios o gestión" on public.outbound_messages for select to authenticated
  using (created_by = auth.uid() or public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.message_templates, public.outbound_messages from anon, authenticated;
grant select on table public.message_templates, public.outbound_messages to authenticated;
grant update (name, body, enabled) on public.message_templates to authenticated;

revoke all on function public.outbound_messages_guard() from public, anon, authenticated;
revoke all on function public.log_outbound_message(public.message_kind, text, text, uuid, uuid) from public, anon;
grant execute on function public.log_outbound_message(public.message_kind, text, text, uuid, uuid) to authenticated;
revoke all on function public.set_outbound_message_status(uuid, public.message_status, text, text) from public, anon, authenticated;
grant execute on function public.set_outbound_message_status(uuid, public.message_status, text, text) to service_role;
