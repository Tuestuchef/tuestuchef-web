-- Gestión de usuarios: roles fijos, invitaciones y bitácora de cambios de rol.
-- Reglas aplicadas aquí (el servidor las valida también):
-- - Solo owner asigna o quita los roles owner y admin. Admin solo gestiona staff.
-- - Siempre existe al menos un owner activo.
-- - Nadie cambia su propio rol ni se desactiva a sí mismo.
-- - Los usuarios no se borran: se desactivan (conserva el historial de created_by).
-- - Un usuario desactivado no obtiene token (hook de Auth) ni pasa RLS (has_role).

-- ============================================================
-- Perfiles: correo y quién invitó
-- ============================================================

alter table public.profiles
  add column email text,
  add column invited_by uuid references public.profiles (id);

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.handle_user_email_change();

-- ============================================================
-- Bitácora de cambios de rol y estado (inmutable)
-- ============================================================

create table public.role_changes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  previous_role public.app_role not null,
  new_role public.app_role not null,
  previous_is_active boolean not null,
  new_is_active boolean not null,
  -- Vacío cuando lo hizo el sistema (service role, script del primer owner).
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

comment on table public.role_changes is
  'Cada cambio de rol o de estado de un usuario. Lo escribe un trigger; nadie lo edita.';

create index role_changes_profile_idx on public.role_changes (profile_id, changed_at desc);

create trigger role_changes_immutable
before update or delete on public.role_changes
for each row execute function public.prevent_mutation();

create trigger role_changes_no_truncate
before truncate on public.role_changes
for each statement execute function public.prevent_mutation();

alter table public.role_changes enable row level security;

create policy "role_changes: owner y admin los ven"
on public.role_changes for select
to authenticated
using (public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on public.role_changes from anon, authenticated;
grant select on public.role_changes to authenticated;

-- ============================================================
-- Reglas de cambio de rol y estado
-- ============================================================

create function public.profiles_guard_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if (select auth.uid()) = old.id then
      raise exception 'No puedes cambiar tu propio rol ni desactivarte.';
    end if;

    if old.role = 'owner' and old.is_active and (new.role <> 'owner' or not new.is_active) then
      -- Bloquea a los owners activos para que dos cambios simultáneos no dejen cero.
      perform 1 from public.profiles where role = 'owner' and is_active for update;
      if not exists (
        select 1 from public.profiles
        where role = 'owner' and is_active and id <> old.id
      ) then
        raise exception 'Debe quedar al menos un owner activo.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_changes
before update on public.profiles
for each row execute function public.profiles_guard_changes();

create function public.profiles_log_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    insert into public.role_changes (
      profile_id, previous_role, new_role, previous_is_active, new_is_active, changed_by
    )
    values (new.id, old.role, new.role, old.is_active, new.is_active, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger profiles_log_role_change
after update on public.profiles
for each row execute function public.profiles_log_role_change();

create function public.profiles_prevent_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los usuarios no se borran: desactívalos para conservar su historial.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger profiles_no_delete
before delete on public.profiles
for each row execute function public.profiles_prevent_delete();

-- Permisos de edición: owner gestiona a todos (menos a sí mismo), admin solo a staff.
grant update (role, is_active) on public.profiles to authenticated;

create policy "profiles: owner gestiona usuarios"
on public.profiles for update
to authenticated
using (
  public.has_role(array['owner']::public.app_role[])
  and id <> (select auth.uid())
)
with check (public.has_role(array['owner']::public.app_role[]));

create policy "profiles: admin gestiona staff"
on public.profiles for update
to authenticated
using (
  public.has_role(array['admin']::public.app_role[])
  and role = 'staff'
  and id <> (select auth.uid())
)
with check (
  public.has_role(array['admin']::public.app_role[])
  and role = 'staff'
);

-- ============================================================
-- Hook de Auth: un usuario desactivado no obtiene token (ni al entrar ni al refrescar).
-- Se activa en config.toml (local) o en Authentication → Hooks (Supabase).
-- ============================================================

create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_active boolean;
begin
  select p.is_active into v_is_active
  from public.profiles p
  where p.id = (event ->> 'user_id')::uuid;

  if v_is_active is not true then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Tu usuario está desactivado. Habla con el dueño o un administrador.'
      )
    );
  end if;

  return event;
end;
$$;

revoke execute on function
  public.handle_user_email_change(),
  public.profiles_guard_changes(),
  public.profiles_log_role_change(),
  public.profiles_prevent_delete(),
  public.custom_access_token_hook(jsonb)
from public, anon, authenticated;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
