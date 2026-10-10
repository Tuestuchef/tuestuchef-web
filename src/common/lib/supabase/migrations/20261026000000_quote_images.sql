-- Imágenes en los presupuestos: fotos del catálogo (las de cada producto y color, sin copiarlas) o
-- subidas libremente (bordados, logos del cliente, muestras), cada una con un nombre ("Filipina manga
-- corta · Vinotinto"). Van en una sección después de los artículos, en pantalla y en el PDF.
--
-- · Se guardan con el borrador (save_quote_draft) y, como las líneas, no cambian después de enviado.
-- · Las subidas van al bucket privado (pueden ser diseños de clientes): quotes/images/<uuid>.<ext>.
-- · Las del catálogo se toman de product_images (bucket público) por su id: la ruta la pone la base.
-- · Una versión nueva o un duplicado copia las imágenes. Máximo 12 por presupuesto.

create table public.quote_images (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  position integer not null default 0,
  label text check (label is null or char_length(label) between 1 and 120),
  source text not null check (source in ('product', 'upload')),
  bucket text not null check (bucket in ('public', 'private')),
  path text not null,
  -- Del catálogo: la foto de origen (si después se borra, queda la ruta).
  product_image_id uuid references public.product_images (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint quote_images_source_path check (
    (source = 'product' and bucket = 'public' and path ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
    or (source = 'upload' and bucket = 'private' and path ~ '^quotes/images/[0-9a-f-]{36}\.(jpg|png|webp)$')
  )
);

create index quote_images_quote_idx on public.quote_images (quote_id, position);

create trigger quote_images_created_audit before insert on public.quote_images
  for each row execute function public.set_created_audit();

-- Las líneas y las imágenes solo cambian mientras el presupuesto es borrador.
create or replace function public.quote_lines_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status public.quote_status;
begin
  if tg_table_name in ('quote_items', 'quote_images') then
    v_quote_id := coalesce(new.quote_id, old.quote_id);
  else
    select quote_id into v_quote_id from public.quote_items where id = coalesce(new.quote_item_id, old.quote_item_id);
  end if;
  select status into v_status from public.quotes where id = v_quote_id;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Las líneas de un presupuesto enviado no cambian: crea una versión nueva.' using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger quote_images_guard before insert or update or delete on public.quote_images
  for each row execute function public.quote_lines_guard();

alter table public.quote_images enable row level security;
create policy "quote_images: todo el equipo las ve" on public.quote_images for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
-- Nadie escribe directo: pasan por save_quote_draft.
revoke all on table public.quote_images from anon, authenticated;
grant select on table public.quote_images to authenticated;

-- Reemplaza las imágenes de un borrador (interna). p_images: [{ source: "product", product_image_id, label }
-- o { source: "upload", path, label }], en orden. Nulo = no se tocan.
create function public.quote_apply_images(p_quote_id uuid, p_images jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_image jsonb;
  v_position integer := 0;
  v_label text;
  v_path text;
begin
  if p_images is null or jsonb_typeof(p_images) = 'null' then
    return;
  end if;
  if jsonb_typeof(p_images) <> 'array' then
    raise exception 'Imágenes inválidas.';
  end if;
  if jsonb_array_length(p_images) > 12 then
    raise exception 'Máximo 12 imágenes por presupuesto.';
  end if;

  delete from public.quote_images where quote_id = p_quote_id;
  for v_image in select * from jsonb_array_elements(p_images) loop
    v_label := nullif(left(trim(coalesce(v_image ->> 'label', '')), 120), '');
    if v_image ->> 'source' = 'product' then
      select path into v_path from public.product_images where id = nullif(v_image ->> 'product_image_id', '')::uuid;
      if v_path is null then
        raise exception 'Una foto del catálogo ya no existe: quítala del presupuesto.';
      end if;
      insert into public.quote_images (quote_id, position, label, source, bucket, path, product_image_id)
      values (p_quote_id, v_position, v_label, 'product', 'public', v_path, (v_image ->> 'product_image_id')::uuid);
    elsif v_image ->> 'source' = 'upload' then
      v_path := v_image ->> 'path';
      if v_path is null or v_path !~ '^quotes/images/[0-9a-f-]{36}\.(jpg|png|webp)$' then
        raise exception 'Una imagen subida no es válida.';
      end if;
      insert into public.quote_images (quote_id, position, label, source, bucket, path)
      values (p_quote_id, v_position, v_label, 'upload', 'private', v_path);
    else
      raise exception 'Imagen inválida.';
    end if;
    v_position := v_position + 1;
  end loop;
end;
$$;

-- El contenido de un presupuesto (para duplicar o versionar) incluye sus imágenes.
create or replace function public.quote_payload(p_quote_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'customer_id', q.customer_id,
    'customer', jsonb_build_object(
      'kind', q.customer_kind, 'name', q.customer_name, 'legal_name', q.customer_legal_name, 'tax_id', q.customer_tax_id,
      'phone', q.customer_phone, 'email', q.customer_email, 'address', q.customer_address, 'contact_person', q.customer_contact_person
    ),
    'currencies', q.currencies,
    'usd_price_method_id', q.usd_price_method_id,
    'ves_price_method_id', q.ves_price_method_id,
    'vat_enabled', q.vat_enabled,
    'igtf_note_enabled', q.igtf_note_enabled,
    'discount_type', q.discount_type,
    'discount_value', q.discount_value,
    'discount_reason', q.discount_reason,
    'group_by_size', q.group_by_size,
    'terms', q.terms,
    'header_image_path', q.header_image_path,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_id', i.variant_id,
        'quantity', i.quantity,
        'discount_percent', i.discount_percent,
        'components', coalesce((
          select jsonb_agg(jsonb_build_object('variant_id', c.variant_id, 'quantity', c.quantity) order by c.position)
          from public.quote_items c where c.parent_item_id = i.id
        ), '[]'),
        'customizations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'type_id', qc.customization_type_id, 'quantity', qc.quantity, 'size_cm', qc.size_cm,
            'position', qc.position, 'text', qc.text, 'note', qc.note
          ))
          from public.quote_item_customizations qc where qc.quote_item_id = i.id
        ), '[]')
      ) order by i.position)
      from public.quote_items i where i.quote_id = q.id and i.parent_item_id is null
    ), '[]'),
    -- Las del catálogo cuya foto de origen se borró no se pueden copiar: se omiten.
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', im.source, 'product_image_id', im.product_image_id, 'path', im.path, 'label', im.label
      ) order by im.position)
      from public.quote_images im
      where im.quote_id = q.id and (im.source = 'upload' or im.product_image_id is not null)
    ), '[]')
  )
  from public.quotes q where q.id = p_quote_id;
$$;

create or replace function public.save_quote_draft(p_quote_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_quote_id;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para hacer presupuestos.' using errcode = '42501';
  end if;
  if v_id is null then
    v_id := public.quote_new_draft();
  elsif not exists (select 1 from public.quotes where id = v_id) then
    raise exception 'El presupuesto no existe.';
  end if;
  perform public.quote_apply(v_id, p_payload);
  perform public.quote_apply_images(v_id, p_payload -> 'images');
  return v_id;
end;
$$;

create or replace function public.new_quote_version(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_id uuid;
  v_payload jsonb;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'El presupuesto no existe.';
  end if;
  if v_quote.superseded_by is not null or exists (select 1 from public.quotes where number = v_quote.number and version > v_quote.version) then
    raise exception 'Ya hay una versión más nueva de %.', v_quote.code;
  end if;
  if v_quote.status not in ('sent', 'rejected', 'expired') then
    raise exception 'Se crea una versión de un presupuesto enviado, rechazado o vencido (este está %).', v_quote.status;
  end if;

  v_id := public.quote_new_draft(v_quote.number, v_quote.version + 1, v_quote.id, null);
  v_payload := public.quote_payload(v_quote.id);
  perform public.quote_apply(v_id, v_payload);
  perform public.quote_apply_images(v_id, v_payload -> 'images');
  update public.quotes set superseded_by = v_id where id = v_quote.id;
  perform public.quote_set_status(v_quote.id, 'superseded', 'Reemplazado por la versión ' || (v_quote.version + 1));
  return v_id;
end;
$$;

create or replace function public.duplicate_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_payload jsonb;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.quotes where id = p_quote_id) then
    raise exception 'El presupuesto no existe.';
  end if;
  v_id := public.quote_new_draft(null, 1, null, p_quote_id);
  v_payload := public.quote_payload(p_quote_id);
  perform public.quote_apply(v_id, v_payload);
  perform public.quote_apply_images(v_id, v_payload -> 'images');
  return v_id;
end;
$$;

revoke all on function public.quote_apply_images(uuid, jsonb) from public, anon, authenticated;
