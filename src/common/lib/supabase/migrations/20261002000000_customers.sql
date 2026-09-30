-- Clientes. Modelo en docs/modelo-de-datos.md (sección 3).
-- - Nombre obligatorio y al menos un medio de contacto (teléfono, email o Instagram).
-- - Teléfono (E.164), email (minúsculas) e Instagram (sin @) llegan normalizados; únicos si existen.
-- - La cédula vive aparte (customer_private): cualquier rol la registra, solo owner y admin la leen.
-- - Los clientes no se borran: se desactivan (las ventas los referencian).

-- ============================================================
-- Tablas
-- ============================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  last_name text check (last_name is null or length(trim(last_name)) between 1 and 60),
  phone text unique check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text unique check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  instagram text unique check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'),
  notes text check (notes is null or length(notes) <= 500),
  -- Indicador visible para todos; el número solo lo ven owner y admin.
  has_id_document boolean not null default false,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint customers_contact_required check (num_nonnulls(phone, email, instagram) >= 1)
);

create index customers_name_idx on public.customers (lower(first_name), lower(coalesce(last_name, '')));

create table public.customer_private (
  customer_id uuid primary key references public.customers (id),
  -- Normalizada: letra + números, p. ej. V12345678.
  id_document text not null check (id_document ~ '^[VEJPG][0-9]{5,10}$'),
  updated_by uuid default auth.uid() references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger customers_created_audit before insert on public.customers
  for each row execute function public.set_created_audit();
create trigger customers_updated_audit before update on public.customers
  for each row execute function public.set_updated_audit();

-- Activar o desactivar es de owner y admin.
create or replace function public.customers_guard_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and not new.is_active or tg_op = 'UPDATE' and new.is_active is distinct from old.is_active)
     and not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'Solo owner y admin pueden activar o desactivar clientes.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger customers_guard_active before insert or update on public.customers
  for each row execute function public.customers_guard_active();

-- ============================================================
-- Cédula: se escribe solo por esta función (staff no puede leer la tabla,
-- así que tampoco podría hacer un update/upsert sobre ella).
-- ============================================================

create or replace function public.set_customer_id_document(p_customer_id uuid, p_id_document text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para registrar la cédula.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'El cliente no existe.' using errcode = 'P0002';
  end if;

  if p_id_document is null or trim(p_id_document) = '' then
    -- Quitar la cédula es de owner y admin.
    if not public.has_role(array['owner', 'admin']::public.app_role[]) then
      raise exception 'Solo owner y admin pueden quitar la cédula.' using errcode = '42501';
    end if;
    delete from public.customer_private where customer_id = p_customer_id;
    update public.customers set has_id_document = false where id = p_customer_id;
    return;
  end if;

  insert into public.customer_private (customer_id, id_document)
  values (p_customer_id, p_id_document)
  on conflict (customer_id) do update
    set id_document = excluded.id_document, updated_by = auth.uid(), updated_at = now();
  update public.customers set has_id_document = true where id = p_customer_id;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.customers enable row level security;

create policy "customers: todo el equipo los ve"
on public.customers for select
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "customers: todo el equipo los crea"
on public.customers for insert
to authenticated
with check (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

create policy "customers: todo el equipo los edita"
on public.customers for update
to authenticated
using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

alter table public.customer_private enable row level security;

create policy "customer_private: solo owner y admin leen la cédula"
on public.customer_private for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

-- ============================================================
-- Permisos
-- ============================================================

revoke all on table public.customers, public.customer_private from anon, authenticated;

grant select on public.customers to authenticated;
grant insert (first_name, last_name, phone, email, instagram, notes, is_active),
      update (first_name, last_name, phone, email, instagram, notes, is_active)
  on public.customers to authenticated;

grant select on public.customer_private to authenticated;

revoke execute on function public.customers_guard_active() from public, anon, authenticated;
revoke execute on function public.set_customer_id_document(uuid, text) from public, anon;
grant execute on function public.set_customer_id_document(uuid, text) to authenticated;
