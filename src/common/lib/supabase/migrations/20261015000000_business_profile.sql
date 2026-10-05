-- Datos del negocio: contacto que ven los clientes en recibos (y más adelante en correos y
-- mensajes). Antes vivían en brand.config.ts; ahora owner y admin los cambian desde Configuración.
-- Los remitentes de correo (AUTH_EMAIL_FROM, NOTIFICATIONS_EMAIL_FROM) siguen en variables de
-- entorno: dependen del dominio verificado en Resend.

create table public.business_profile (
  id boolean primary key default true check (id),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Mismo formato que clientes: E.164 (+584141234567).
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  -- Usuario sin @.
  instagram text check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'),
  address text check (address is null or length(trim(address)) between 1 and 300),
  -- RIF normalizado: letra + números (J123456789).
  tax_id text check (tax_id is null or tax_id ~ '^[VEJPG][0-9]{5,10}$'),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.business_profile (email) values ('contacto@tuestuchef.com');

create trigger business_profile_updated_audit before update on public.business_profile
  for each row execute function public.set_settings_audit();

alter table public.business_profile enable row level security;

-- Todos lo leen (staff imprime recibos); solo owner y admin lo editan.
create policy "business_profile: todos ven" on public.business_profile for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "business_profile: owner y admin editan" on public.business_profile for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.business_profile from anon, authenticated;
grant select on table public.business_profile to authenticated;
grant update (email, phone, whatsapp, instagram, address, tax_id) on public.business_profile to authenticated;
