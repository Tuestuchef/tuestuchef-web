-- Roles y perfiles del equipo.
-- Nadie recibe trato especial: todo acceso se decide por rol (owner, admin, staff) y se aplica con RLS.

create type public.app_role as enum ('owner', 'admin', 'staff');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Un perfil por usuario del sistema. El rol define los permisos.';

-- updated_at genérico, reutilizable por las tablas que vengan.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Todo usuario nuevo de Auth recibe un perfil con el rol mínimo (staff).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Helpers de rol para las políticas RLS de todas las tablas.
-- Un usuario inactivo no tiene rol, y por tanto no tiene acceso.
create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

create function public.has_role(allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = any (allowed), false);
$$;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RLS
alter table public.profiles enable row level security;

create policy "profiles: cada quien ve su perfil"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "profiles: owner y admin ven todos"
on public.profiles for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

-- Cada quien puede editar solo su nombre. El rol y el estado se gestionan
-- con service role (panel de Supabase) hasta que llegue el módulo de equipo (Fase 2).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "profiles: cada quien edita su nombre"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
