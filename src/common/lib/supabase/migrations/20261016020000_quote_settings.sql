-- Configuración de presupuestos (paso 1). Owner y admin la editan; todos la leen (la usa el
-- formulario de presupuesto).
--
-- Numeración: prefijo + siguiente número con relleno de ceros (TLT00001). El siguiente número
-- solo puede subir: así nunca se repite uno ya emitido.
-- Listas de precios por defecto: una de un método en USD y otra de un método en Bs. Cuando
-- un presupuesto muestra ambas monedas, cada una sale de su propia lista.
-- IVA: opcional por presupuesto, sobre el total; aquí van la tasa y si viene marcado.

create type public.quote_currencies as enum ('usd', 'ves', 'both');

create table public.quote_settings (
  id boolean primary key default true check (id),
  number_prefix text not null default 'TLT' check (number_prefix ~ '^[A-Z0-9-]{1,10}$'),
  number_padding integer not null default 5 check (number_padding between 1 and 10),
  next_number integer not null default 1 check (next_number >= 1),
  validity_days integer not null default 7 check (validity_days between 1 and 365),
  default_currencies public.quote_currencies not null default 'usd',
  default_usd_price_method_id uuid references public.payment_methods (id),
  default_ves_price_method_id uuid references public.payment_methods (id),
  vat_percent numeric(5, 2) not null default 16 check (vat_percent >= 0 and vat_percent <= 100),
  vat_default_enabled boolean not null default false,
  igtf_note_default boolean not null default false,
  igtf_note text not null
    default 'Los pagos en divisas o criptomonedas pueden estar sujetos al Impuesto a las Grandes Transacciones Financieras (IGTF).'
    check (length(trim(igtf_note)) between 1 and 500),
  default_terms text not null
    default E'Vigencia: este presupuesto es válido hasta la fecha de vencimiento indicada.\n'
         || E'Tiempo de entrega: de 3 a 5 días hábiles según la cantidad, a partir de la confirmación del abono.\n'
         || E'Abono: en pedidos de 500 USD o más, 60% al confirmar y 40% en la entrega; por debajo de ese monto, pago completo al confirmar.\n'
         || E'Métodos de pago: pago móvil, transferencia, Zelle, USDT y efectivo.\n'
         || 'Personalización: los bordados y logos se aprueban con una muestra antes de producir.'
    check (length(trim(default_terms)) between 1 and 3000),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
insert into public.quote_settings default values;

create trigger quote_settings_updated_audit before update on public.quote_settings
  for each row execute function public.set_settings_audit();

-- El siguiente número solo sube, y cada lista por defecto debe ser de un método de su moneda.
create or replace function public.quote_settings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'El siguiente número solo puede aumentar (actual: %).', old.next_number using errcode = 'check_violation';
  end if;
  if new.default_usd_price_method_id is not null and not exists (
    select 1 from public.payment_methods where id = new.default_usd_price_method_id and price_currency = 'USD'
  ) then
    raise exception 'La lista en USD debe ser de un método de pago en dólares.' using errcode = 'check_violation';
  end if;
  if new.default_ves_price_method_id is not null and not exists (
    select 1 from public.payment_methods where id = new.default_ves_price_method_id and price_currency = 'VES'
  ) then
    raise exception 'La lista en Bs debe ser de un método de pago en bolívares.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger quote_settings_guard before update on public.quote_settings
  for each row execute function public.quote_settings_guard();

alter table public.quote_settings enable row level security;

create policy "quote_settings: todos ven" on public.quote_settings for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "quote_settings: owner y admin editan" on public.quote_settings for update to authenticated
  using (public.has_role(array['owner', 'admin']::public.app_role[]))
  with check (public.has_role(array['owner', 'admin']::public.app_role[]));

revoke all on table public.quote_settings from anon, authenticated;
grant select on table public.quote_settings to authenticated;
grant update (
  number_prefix, number_padding, next_number, validity_days, default_currencies,
  default_usd_price_method_id, default_ves_price_method_id, vat_percent, vat_default_enabled,
  igtf_note_default, igtf_note, default_terms
) on public.quote_settings to authenticated;

revoke all on function public.quote_settings_guard() from public, anon, authenticated;
