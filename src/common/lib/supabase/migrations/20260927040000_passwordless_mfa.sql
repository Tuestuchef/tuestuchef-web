-- Acceso sin contraseña (código por correo) y 2FA obligatorio para owner y admin.
--
-- - owner y admin solo ejercen su rol con una sesión aal2 (código de la app
--   autenticadora verificado). Con aal1 no tienen rol: RLS les niega todo, igual
--   que a un usuario sin sesión. Staff entra con aal1 (solo código por correo).
-- - Quién puede pedir un código lo decide el servidor con la clave secreta; la
--   función no está expuesta a anon ni a authenticated (no permite averiguar qué
--   correos existen).
-- - Un usuario desactivado no puede pedir código y el hook de Auth no le emite
--   token aunque lo tuviera.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and (
      p.role = 'staff'
      or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    );
$$;

create function public.can_request_login_code(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.email) = lower(trim(p_email))
      and p.is_active
  );
$$;

revoke execute on function public.can_request_login_code(text) from public, anon, authenticated;
grant execute on function public.can_request_login_code(text) to service_role;
