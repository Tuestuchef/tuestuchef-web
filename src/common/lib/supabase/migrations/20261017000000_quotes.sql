-- Presupuestos, paso 2: tablas, numeración, precios, estados e inmutabilidad.
--
-- Un presupuesto no es una factura fiscal ni mueve dinero ni inventario.
-- · Numeración sin huecos: el número sale de quote_settings.next_number con la fila bloqueada,
--   en la misma transacción que crea el presupuesto, y los presupuestos nunca se borran (un
--   borrador que no se envía se descarta).
-- · Solo un borrador se edita. Al enviarlo queda congelado; cambiarlo crea una versión nueva
--   (mismo número, -v2) y la anterior queda "reemplazada".
-- · Precios: los calcula la base al guardar el borrador, igual que en pedidos (lista del
--   método de pago, descuento al mayor de productos por piezas y de personalización por tipo,
--   descuento manual con motivo y límite para staff). Si se muestran USD y Bs, cada moneda sale
--   de su propia lista; el monto en Bs = precio de la lista en Bs × tasa BCV de la fecha.
-- · IVA opcional sobre el total (después de descuentos). IGTF: solo una nota.
-- · Cada cambio de estado queda en quote_status_events con quién y cuándo.

create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'discarded', 'superseded');
create type public.quote_item_kind as enum ('product', 'combo', 'component');

-- La auditoría de la configuración no cuenta el avance del número (lo hace cada presupuesto).
create or replace function public.quote_settings_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'next_number' - 'updated_by' - 'updated_at') is distinct from (to_jsonb(old) - 'next_number' - 'updated_by' - 'updated_at') then
    new.updated_by := auth.uid();
    new.updated_at := now();
  else
    new.updated_by := old.updated_by;
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger quote_settings_updated_audit on public.quote_settings;
create trigger quote_settings_updated_audit before update on public.quote_settings
  for each row execute function public.quote_settings_audit();

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number integer not null check (number >= 1),
  version integer not null default 1 check (version >= 1),
  -- Número visible congelado al crearlo (TLT00042, TLT00042-v2): cambiar el prefijo no lo altera.
  code text not null unique,
  status public.quote_status not null default 'draft',
  status_changed_at timestamptz not null default now(),

  -- Cliente: enlace opcional y copia de sus datos (lo enviado no cambia si se edita el cliente).
  customer_id uuid references public.customers (id),
  customer_kind public.customer_kind not null default 'person',
  customer_name text not null default '' check (length(customer_name) <= 150),
  customer_legal_name text check (customer_legal_name is null or length(customer_legal_name) <= 150),
  customer_tax_id text check (customer_tax_id is null or customer_tax_id ~ '^[VEJPG][0-9]{5,10}$'),
  customer_phone text check (customer_phone is null or customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  customer_email text check (customer_email is null or length(customer_email) <= 254),
  customer_address text check (customer_address is null or length(customer_address) <= 300),
  customer_contact_person text check (customer_contact_person is null or length(customer_contact_person) <= 100),

  issued_on date not null default public.caracas_today(),
  valid_until date not null,

  currencies public.quote_currencies not null default 'usd',
  usd_price_method_id uuid references public.payment_methods (id),
  ves_price_method_id uuid references public.payment_methods (id),
  bcv_usd_rate numeric(20, 6),
  bcv_eur_rate numeric(20, 6),
  -- Tasa con la que se muestran los montos en Bs (la del método de la lista en Bs).
  ves_rate numeric(20, 6),

  vat_enabled boolean not null default false,
  vat_percent numeric(5, 2) not null default 0 check (vat_percent >= 0 and vat_percent <= 100),
  igtf_note_enabled boolean not null default false,
  igtf_note text check (igtf_note is null or length(igtf_note) <= 500),

  discount_type public.discount_type,
  discount_value numeric(20, 2) check (discount_value is null or discount_value > 0),
  discount_reason text check (discount_reason is null or length(trim(discount_reason)) between 1 and 300),
  discount_by uuid references public.profiles (id),

  group_by_size boolean not null default false,
  terms text check (terms is null or length(terms) <= 3000),
  -- Imagen del encabezado solo para este presupuesto (si no, la de Datos de la empresa).
  header_image_path text check (header_image_path is null or header_image_path ~ '^quotes/header/[0-9a-f-]{36}\.(png|jpg)$'),

  -- Totales: piezas, descuento al mayor de productos (mismo % en ambas listas) y uno por lista.
  pieces numeric(12, 3) not null default 0,
  volume_discount_percent numeric(5, 2) not null default 0,
  customization_total_usd numeric(20, 2) not null default 0,
  usd_subtotal numeric(20, 2) not null default 0,
  usd_volume_discount numeric(20, 2) not null default 0,
  usd_line_discounts numeric(20, 2) not null default 0,
  usd_discount numeric(20, 2) not null default 0,
  usd_vat numeric(20, 2) not null default 0,
  usd_total numeric(20, 2) not null default 0,
  ves_subtotal numeric(20, 2) not null default 0,
  ves_volume_discount numeric(20, 2) not null default 0,
  ves_line_discounts numeric(20, 2) not null default 0,
  ves_discount numeric(20, 2) not null default 0,
  ves_vat numeric(20, 2) not null default 0,
  ves_total numeric(20, 2) not null default 0,
  -- ves_total × ves_rate: el total en bolívares que se muestra.
  ves_total_bs numeric(20, 2) not null default 0,

  -- Quién lo generó (copia: nombre y correo de su usuario, teléfono de su ficha en Equipo).
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_by_name text not null default '',
  created_by_email text,
  created_by_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  replaces_id uuid references public.quotes (id),
  superseded_by uuid references public.quotes (id),
  duplicated_from uuid references public.quotes (id),
  -- Pedido en que se convirtió (paso de conversión). Único: se convierte una sola vez.
  order_sale_id uuid unique references public.sales (id),
  -- Enlace público para ver el PDF (se crea al enviarlo; se puede revocar).
  public_token text unique check (public_token is null or public_token ~ '^[0-9a-f]{64}$'),
  token_revoked_at timestamptz,
  -- PDF congelado al enviarlo (bucket privado).
  pdf_path text check (pdf_path is null or pdf_path ~ '^quotes/[0-9]{4}/[0-9]{2}/[A-Za-z0-9-]+\.pdf$'),

  constraint quotes_number_version unique (number, version),
  constraint quotes_valid_dates check (valid_until >= issued_on),
  constraint quotes_name_when_sent check (status = 'draft' or status = 'discarded' or length(trim(customer_name)) > 0),
  constraint quotes_lists check (
    (currencies = 'ves' or usd_price_method_id is not null or status in ('draft', 'discarded'))
    and (currencies = 'usd' or ves_price_method_id is not null or status in ('draft', 'discarded'))
  )
);
create index quotes_status_idx on public.quotes (status, issued_on desc);
create index quotes_customer_idx on public.quotes (customer_id, issued_on desc);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  parent_item_id uuid references public.quote_items (id) on delete cascade,
  position integer not null check (position >= 0),
  kind public.quote_item_kind not null,
  variant_id uuid not null references public.product_variants (id),
  -- Copia para mostrar: lo enviado no cambia si se renombra el producto.
  product_name text not null,
  sku text not null,
  color_name text,
  size_name text,
  size_sort integer,
  quantity numeric(12, 3) not null check (quantity > 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  -- Precio unitario en USD de referencia de cada lista (0 en componentes de combo).
  usd_unit_price numeric(20, 2) not null default 0 check (usd_unit_price >= 0),
  ves_unit_price numeric(20, 2) not null default 0 check (ves_unit_price >= 0),
  usd_line_total numeric(20, 2) not null default 0,
  ves_line_total numeric(20, 2) not null default 0,
  constraint quote_items_component check ((kind = 'component') = (parent_item_id is not null))
);
create index quote_items_quote_idx on public.quote_items (quote_id, position);

create table public.quote_item_customizations (
  id uuid primary key default gen_random_uuid(),
  quote_item_id uuid not null references public.quote_items (id) on delete cascade,
  customization_type_id uuid not null references public.customization_types (id),
  type_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  size_cm numeric(5, 1) check (size_cm is null or size_cm > 0),
  position text check (position is null or length(position) <= 60),
  text text check (text is null or length(trim(text)) between 1 and 60),
  note text check (note is null or length(note) <= 300),
  unit_price_usd numeric(20, 2) not null check (unit_price_usd > 0),
  discount_percent numeric(5, 2) not null default 0,
  line_total_usd numeric(20, 2) not null check (line_total_usd >= 0)
);

create table public.quote_status_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id),
  status public.quote_status not null,
  note text check (note is null or length(note) <= 300),
  -- Nulo cuando lo hace el sistema (vencimiento automático).
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index quote_status_events_quote_idx on public.quote_status_events (quote_id, created_at);
create trigger quote_status_events_immutable before update or delete on public.quote_status_events
  for each row execute function public.prevent_mutation();

-- ============================================================
-- Inmutabilidad
-- ============================================================

-- Fuera de borrador solo cambian el estado y los datos de envío/conversión. Nunca se borran.
create or replace function public.quotes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_free constant text[] := array[
    'status', 'status_changed_at', 'superseded_by', 'order_sale_id', 'public_token',
    'token_revoked_at', 'pdf_path', 'updated_at'
  ];
begin
  if tg_op = 'DELETE' then
    raise exception 'Los presupuestos no se borran: un borrador se descarta.' using errcode = 'restrict_violation';
  end if;
  if old.status <> 'draft' and (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'El presupuesto % ya no es un borrador: para cambiarlo crea una versión nueva.', old.code
      using errcode = 'restrict_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger quotes_guard before update or delete on public.quotes
  for each row execute function public.quotes_guard();

-- Las líneas solo cambian mientras el presupuesto es borrador.
create or replace function public.quote_lines_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status public.quote_status;
begin
  if tg_table_name = 'quote_items' then
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

create trigger quote_items_guard before insert or update or delete on public.quote_items
  for each row execute function public.quote_lines_guard();
create trigger quote_item_customizations_guard before insert or update or delete on public.quote_item_customizations
  for each row execute function public.quote_lines_guard();

-- ============================================================
-- Estado efectivo y vista de lista
-- ============================================================

-- Un enviado cuya fecha pasó ya está vencido aunque el registro diario no haya corrido.
create or replace function public.quote_effective_status(p_status public.quote_status, p_valid_until date)
returns public.quote_status
language sql
stable
set search_path = ''
as $$
  select case when p_status = 'sent' and p_valid_until < public.caracas_today() then 'expired'::public.quote_status else p_status end;
$$;

create view public.quotes_overview with (security_invoker = true) as
select
  q.id, q.code, q.number, q.version, q.status,
  public.quote_effective_status(q.status, q.valid_until) as effective_status,
  q.customer_id, q.customer_name, q.customer_legal_name, q.issued_on, q.valid_until,
  q.currencies, q.usd_total, q.ves_total, q.ves_total_bs, q.vat_enabled,
  q.created_by, q.created_by_name, q.created_at, q.status_changed_at, q.order_sale_id, q.superseded_by
from public.quotes q;

-- ============================================================
-- Funciones internas
-- ============================================================

-- Registra un cambio de estado (interna).
create or replace function public.quote_set_status(p_quote_id uuid, p_status public.quote_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quotes set status = p_status, status_changed_at = now() where id = p_quote_id;
  insert into public.quote_status_events (quote_id, status, note) values (p_quote_id, p_status, nullif(trim(p_note), ''));
end;
$$;

-- Crea la fila de un borrador con su número (interna). Sin p_number toma el siguiente, con la
-- fila de configuración bloqueada: dos presupuestos a la vez nunca reciben el mismo número.
create or replace function public.quote_new_draft(
  p_number integer default null,
  p_version integer default 1,
  p_replaces uuid default null,
  p_duplicated_from uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.quote_settings;
  v_number integer := p_number;
  v_id uuid;
  v_name text;
  v_email text;
  v_phone text;
begin
  select * into v_settings from public.quote_settings for update;
  if v_number is null then
    v_number := v_settings.next_number;
    update public.quote_settings set next_number = next_number + 1 where id;
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  select email into v_email from auth.users where id = auth.uid();
  select phone into v_phone from public.team_members where profile_id = auth.uid();

  insert into public.quotes (
    number, version, code, valid_until, currencies, usd_price_method_id, ves_price_method_id,
    vat_enabled, vat_percent, igtf_note_enabled, igtf_note, terms,
    created_by_name, created_by_email, created_by_phone, replaces_id, duplicated_from
  )
  values (
    v_number, p_version,
    v_settings.number_prefix || lpad(v_number::text, greatest(v_settings.number_padding, length(v_number::text)), '0')
      || case when p_version > 1 then '-v' || p_version else '' end,
    public.caracas_today() + v_settings.validity_days,
    v_settings.default_currencies, v_settings.default_usd_price_method_id, v_settings.default_ves_price_method_id,
    v_settings.vat_default_enabled, v_settings.vat_percent, v_settings.igtf_note_default, v_settings.igtf_note,
    v_settings.default_terms,
    coalesce(nullif(trim(v_name), ''), 'Equipo'), v_email, v_phone, p_replaces, p_duplicated_from
  )
  returning id into v_id;

  insert into public.quote_status_events (quote_id, status) values (v_id, 'draft');
  return v_id;
end;
$$;

-- Aplica el contenido de un borrador: cliente, opciones y líneas, y recalcula los totales
-- (interna). Reemplaza todas las líneas.
create or replace function public.quote_apply(p_quote_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_is_management boolean := public.has_role(array['owner', 'admin']::public.app_role[]);
  v_max_percent numeric;
  v_customer public.customers;
  v_currencies public.quote_currencies := coalesce(p_payload ->> 'currencies', 'usd')::public.quote_currencies;
  v_use_usd boolean;
  v_use_ves boolean;
  v_usd_method public.payment_methods;
  v_ves_method public.payment_methods;
  v_rate public.exchange_rates;
  v_ves_rate numeric;
  v_valid_until date;
  v_settings public.quote_settings;
  v_item jsonb;
  v_component jsonb;
  v_custom jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_qty numeric;
  v_line_discount numeric;
  v_usd_price numeric;
  v_ves_price numeric;
  v_position integer := 0;
  v_item_id uuid;
  v_pieces numeric := 0;
  v_usd_products numeric := 0;
  v_ves_products numeric := 0;
  v_usd_line_disc numeric := 0;
  v_ves_line_disc numeric := 0;
  v_type public.customization_types;
  v_type_totals jsonb := '{}';
  v_custom_qty numeric;
  v_custom_total numeric := 0;
  v_percent numeric;
  v_volume_percent numeric;
  v_def record;
  v_given numeric;
  v_discount_type public.discount_type := nullif(p_payload ->> 'discount_type', '')::public.discount_type;
  v_discount_value numeric := nullif(p_payload ->> 'discount_value', '')::numeric;
  v_discount_reason text := nullif(trim(p_payload ->> 'discount_reason'), '');
  v_usd jsonb;
  v_ves jsonb;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.status <> 'draft' then
    raise exception 'El presupuesto % ya no es un borrador: para cambiarlo crea una versión nueva.', v_quote.code;
  end if;
  select * into v_settings from public.quote_settings;
  select staff_max_discount_percent into v_max_percent from public.sales_settings;

  -- Cliente: el enlazado manda (con sus datos actuales); si no, basta con un nombre.
  if nullif(p_payload ->> 'customer_id', '') is not null then
    select * into v_customer from public.customers where id = (p_payload ->> 'customer_id')::uuid;
    if not found or not v_customer.is_active then
      raise exception 'El cliente no existe o está inactivo.';
    end if;
    if v_customer.blocked_at is not null then
      raise exception 'Cliente bloqueado: no puede recibir presupuestos. Motivo: %', coalesce(v_customer.blocked_reason, '—');
    end if;
    update public.quotes set
      customer_id = v_customer.id,
      customer_kind = v_customer.kind,
      customer_name = left(trim(concat_ws(' ', v_customer.first_name, v_customer.last_name)), 150),
      customer_legal_name = v_customer.legal_name,
      customer_tax_id = v_customer.tax_id,
      customer_phone = v_customer.phone,
      customer_email = v_customer.email,
      customer_address = v_customer.address,
      customer_contact_person = v_customer.contact_person
    where id = p_quote_id;
  else
    if coalesce(trim(p_payload #>> '{customer,name}'), '') = '' then
      raise exception 'Escribe el nombre del cliente.';
    end if;
    update public.quotes set
      customer_id = null,
      customer_kind = coalesce(nullif(p_payload #>> '{customer,kind}', ''), 'person')::public.customer_kind,
      customer_name = left(trim(p_payload #>> '{customer,name}'), 150),
      customer_legal_name = nullif(trim(p_payload #>> '{customer,legal_name}'), ''),
      customer_tax_id = nullif(trim(p_payload #>> '{customer,tax_id}'), ''),
      customer_phone = nullif(trim(p_payload #>> '{customer,phone}'), ''),
      customer_email = nullif(trim(p_payload #>> '{customer,email}'), ''),
      customer_address = nullif(trim(p_payload #>> '{customer,address}'), ''),
      customer_contact_person = nullif(trim(p_payload #>> '{customer,contact_person}'), '')
    where id = p_quote_id;
  end if;

  -- Listas de precios de las monedas que se muestran.
  v_use_usd := v_currencies in ('usd', 'both');
  v_use_ves := v_currencies in ('ves', 'both');
  if v_use_usd then
    select * into v_usd_method from public.payment_methods where id = nullif(p_payload ->> 'usd_price_method_id', '')::uuid;
    if v_usd_method.id is null or not v_usd_method.is_active or v_usd_method.price_currency <> 'USD' then
      raise exception 'Elige la lista de precios en USD (un método de pago en dólares, activo).';
    end if;
  end if;
  if v_use_ves then
    select * into v_ves_method from public.payment_methods where id = nullif(p_payload ->> 'ves_price_method_id', '')::uuid;
    if v_ves_method.id is null or not v_ves_method.is_active or v_ves_method.price_currency <> 'VES' then
      raise exception 'Elige la lista de precios en Bs (un método de pago en bolívares, activo).';
    end if;
    -- La tasa de hoy (la fecha del presupuesto se actualiza al guardar el borrador).
    v_rate := public.require_exchange_rate_for_date(public.caracas_today());
    v_ves_rate := case v_ves_method.rate_kind when 'bcv_eur' then v_rate.bcv_eur else v_rate.bcv_usd end;
  else
    v_rate := public.exchange_rate_for_date(public.caracas_today());
  end if;

  v_valid_until := coalesce(nullif(p_payload ->> 'valid_until', '')::date, public.caracas_today() + v_settings.validity_days);
  if v_valid_until < public.caracas_today() then
    raise exception 'La fecha de vencimiento no puede ser pasada.';
  end if;

  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;

  delete from public.quote_items where quote_id = p_quote_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida.';
    end if;
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;
    select * into v_product from public.products where id = v_variant.product_id;
    if not v_product.is_active or not v_variant.is_active then
      raise exception '"%" (%) está inactivo.', v_product.name, v_variant.sku;
    end if;

    v_line_discount := coalesce(nullif(v_item ->> 'discount_percent', '')::numeric, 0);
    if v_line_discount < 0 or v_line_discount > 100 then
      raise exception 'Descuento inválido en "%".', v_product.name;
    end if;
    if v_line_discount > 0 and not v_is_management and v_line_discount > v_max_percent + 0.0001 then
      raise exception '%', format('El descuento máximo sin owner o admin es %s%% ("%s").', trim_scale(v_max_percent), v_product.name);
    end if;
    if v_line_discount > 0 and v_discount_reason is null then
      raise exception 'Indica el motivo del descuento.';
    end if;

    v_usd_price := 0;
    v_ves_price := 0;
    if v_use_usd then
      select amount_usd into v_usd_price from public.product_prices where product_id = v_product.id and payment_method_id = v_usd_method.id;
      if v_usd_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_usd_method.name;
      end if;
    end if;
    if v_use_ves then
      select amount_usd into v_ves_price from public.product_prices where product_id = v_product.id and payment_method_id = v_ves_method.id;
      if v_ves_price is null then
        raise exception '"%" no tiene precio para %. Owner o admin debe cargarlo.', v_product.name, v_ves_method.name;
      end if;
    end if;

    if v_product.kind = 'combo' and v_qty <> trunc(v_qty) then
      raise exception 'Los combos van por unidades enteras.';
    end if;

    insert into public.quote_items (
      quote_id, position, kind, variant_id, product_name, sku, color_name, size_name, size_sort, quantity,
      discount_percent, usd_unit_price, ves_unit_price, usd_line_total, ves_line_total
    )
    select
      p_quote_id, v_position, case when v_product.kind = 'combo' then 'combo' else 'product' end::public.quote_item_kind,
      v_variant.id, v_product.name, v_variant.sku, c.name, s.name, s.sort_order, v_qty,
      v_line_discount, coalesce(v_usd_price, 0), coalesce(v_ves_price, 0),
      round(coalesce(v_usd_price, 0) * v_qty * (1 - v_line_discount / 100), 2),
      round(coalesce(v_ves_price, 0) * v_qty * (1 - v_line_discount / 100), 2)
    from (select 1) x
    left join public.colors c on c.id = v_variant.color_id
    left join public.sizes s on s.id = v_variant.size_id
    returning id into v_item_id;
    v_position := v_position + 1;

    v_usd_products := v_usd_products + round(coalesce(v_usd_price, 0) * v_qty, 2);
    v_ves_products := v_ves_products + round(coalesce(v_ves_price, 0) * v_qty, 2);
    v_usd_line_disc := v_usd_line_disc + round(coalesce(v_usd_price, 0) * v_qty, 2) - round(coalesce(v_usd_price, 0) * v_qty * (1 - v_line_discount / 100), 2);
    v_ves_line_disc := v_ves_line_disc + round(coalesce(v_ves_price, 0) * v_qty, 2) - round(coalesce(v_ves_price, 0) * v_qty * (1 - v_line_discount / 100), 2);

    if v_product.kind = 'combo' then
      if jsonb_array_length(coalesce(v_item -> 'customizations', '[]')) > 0 then
        raise exception 'La personalización va en productos sueltos, no en combos.';
      end if;
      for v_component in select * from jsonb_array_elements(coalesce(v_item -> 'components', '[]')) loop
        declare
          v_c_variant public.product_variants;
          v_c_product public.products;
          v_c_qty numeric := (v_component ->> 'quantity')::numeric;
        begin
          if v_c_qty is null or v_c_qty <= 0 then
            raise exception 'Cantidad inválida en un componente de "%".', v_product.name;
          end if;
          select * into v_c_variant from public.product_variants where id = (v_component ->> 'variant_id')::uuid;
          select * into v_c_product from public.products where id = v_c_variant.product_id;
          if v_c_product.id is null or not exists (
            select 1 from public.combo_components where combo_product_id = v_product.id and component_product_id = v_c_product.id
          ) then
            raise exception 'Un componente no es parte del combo "%".', v_product.name;
          end if;
          if not v_c_product.is_active or not v_c_variant.is_active then
            raise exception '"%" (%) está inactivo.', v_c_product.name, v_c_variant.sku;
          end if;
          insert into public.quote_items (quote_id, parent_item_id, position, kind, variant_id, product_name, sku, color_name, size_name, size_sort, quantity)
          select p_quote_id, v_item_id, v_position, 'component', v_c_variant.id, v_c_product.name, v_c_variant.sku, c.name, s.name, s.sort_order, v_c_qty
          from (select 1) x
          left join public.colors c on c.id = v_c_variant.color_id
          left join public.sizes s on s.id = v_c_variant.size_id;
          v_position := v_position + 1;
          v_pieces := v_pieces + v_c_qty;
        end;
      end loop;
      -- Cada combo lleva exactamente sus piezas.
      for v_def in
        select cc.component_product_id, cc.quantity, p.name
        from public.combo_components cc join public.products p on p.id = cc.component_product_id
        where cc.combo_product_id = v_product.id
      loop
        select coalesce(sum(qi.quantity), 0) into v_given
        from public.quote_items qi join public.product_variants pv on pv.id = qi.variant_id
        where qi.parent_item_id = v_item_id and pv.product_id = v_def.component_product_id;
        if v_given <> v_def.quantity * v_qty then
          raise exception 'El combo "%" lleva % de "%": elegiste %.', v_product.name, trim_scale(v_def.quantity * v_qty), v_def.name, trim_scale(v_given);
        end if;
      end loop;
    else
      v_pieces := v_pieces + v_qty;
      for v_custom in select * from jsonb_array_elements(coalesce(v_item -> 'customizations', '[]')) loop
        select * into v_type from public.customization_types where id = (v_custom ->> 'type_id')::uuid;
        if not found or not v_type.is_active then
          raise exception 'Una personalización no existe o está inactiva.';
        end if;
        if v_type.unit_price_usd is null then
          raise exception '"%" todavía no tiene precio: owner o admin debe cargarlo en Configuración.', v_type.name;
        end if;
        v_custom_qty := coalesce(nullif(v_custom ->> 'quantity', '')::numeric, v_qty);
        if v_custom_qty <= 0 or v_custom_qty > v_qty then
          raise exception '"%": la cantidad debe estar entre 1 y las piezas de la línea.', v_type.name;
        end if;
        if v_type.max_size_cm is not null and nullif(v_custom ->> 'size_cm', '')::numeric > v_type.max_size_cm then
          raise exception '"%" es de hasta % cm: más grande se considera logo de pecho.', v_type.name, trim_scale(v_type.max_size_cm);
        end if;
        -- Precio provisional; el descuento al mayor por tipo se aplica abajo, con el total del tipo.
        insert into public.quote_item_customizations (
          quote_item_id, customization_type_id, type_name, quantity, size_cm, position, text, note, unit_price_usd, line_total_usd
        )
        values (
          v_item_id, v_type.id, v_type.name, v_custom_qty, nullif(v_custom ->> 'size_cm', '')::numeric,
          nullif(trim(v_custom ->> 'position'), ''), nullif(trim(v_custom ->> 'text'), ''), nullif(trim(v_custom ->> 'note'), ''),
          v_type.unit_price_usd, round(v_custom_qty * v_type.unit_price_usd, 2)
        );
        v_type_totals := v_type_totals || jsonb_build_object(v_type.id::text, coalesce((v_type_totals ->> v_type.id::text)::numeric, 0) + v_custom_qty);
      end loop;
    end if;
  end loop;

  -- Personalización: mínimo por tipo y descuento al mayor por tipo (igual que en pedidos).
  for v_type in select * from public.customization_types where v_type_totals ? id::text loop
    v_custom_qty := (v_type_totals ->> v_type.id::text)::numeric;
    if v_custom_qty < v_type.min_quantity then
      raise exception '"%" es desde % piezas (van %).', v_type.name, v_type.min_quantity, trim_scale(v_custom_qty);
    end if;
    v_percent := public.volume_discount_percent('customization', v_custom_qty);
    v_custom_total := v_custom_total + round(v_custom_qty * v_type.unit_price_usd * (1 - v_percent / 100), 2);
    update public.quote_item_customizations qc
    set discount_percent = v_percent, line_total_usd = round(qc.quantity * qc.unit_price_usd * (1 - v_percent / 100), 2)
    from public.quote_items qi
    where qi.id = qc.quote_item_id and qi.quote_id = p_quote_id and qc.customization_type_id = v_type.id;
  end loop;

  -- Totales de cada lista.
  v_volume_percent := public.volume_discount_percent('products', v_pieces);
  if v_discount_type is not null and coalesce(v_discount_value, 0) > 0 and v_discount_reason is null then
    raise exception 'Indica el motivo del descuento.';
  end if;

  select jsonb_build_object('subtotal', t.subtotal, 'volume', t.volume, 'discount', t.discount, 'vat', t.vat) into v_usd
  from public.quote_totals(v_use_usd, v_usd_products, v_usd_line_disc, v_custom_total, v_volume_percent,
                           v_discount_type, v_discount_value, (p_payload ->> 'vat_enabled')::boolean, v_settings.vat_percent,
                           v_is_management, v_max_percent) t;
  select jsonb_build_object('subtotal', t.subtotal, 'volume', t.volume, 'discount', t.discount, 'vat', t.vat) into v_ves
  from public.quote_totals(v_use_ves, v_ves_products, v_ves_line_disc, v_custom_total, v_volume_percent,
                           v_discount_type, v_discount_value, (p_payload ->> 'vat_enabled')::boolean, v_settings.vat_percent,
                           v_is_management, v_max_percent) t;

  update public.quotes set
    issued_on = public.caracas_today(),
    valid_until = v_valid_until,
    currencies = v_currencies,
    usd_price_method_id = case when v_use_usd then v_usd_method.id end,
    ves_price_method_id = case when v_use_ves then v_ves_method.id end,
    bcv_usd_rate = v_rate.bcv_usd,
    bcv_eur_rate = v_rate.bcv_eur,
    ves_rate = v_ves_rate,
    vat_enabled = coalesce((p_payload ->> 'vat_enabled')::boolean, false),
    vat_percent = v_settings.vat_percent,
    igtf_note_enabled = coalesce((p_payload ->> 'igtf_note_enabled')::boolean, false),
    igtf_note = v_settings.igtf_note,
    discount_type = case when coalesce(v_discount_value, 0) > 0 then v_discount_type end,
    discount_value = case when coalesce(v_discount_value, 0) > 0 then v_discount_value end,
    discount_reason = case when coalesce(v_discount_value, 0) > 0 or v_usd_line_disc + v_ves_line_disc > 0 then v_discount_reason end,
    discount_by = case when coalesce(v_discount_value, 0) > 0 or v_usd_line_disc + v_ves_line_disc > 0 then auth.uid() end,
    group_by_size = coalesce((p_payload ->> 'group_by_size')::boolean, false),
    terms = nullif(trim(p_payload ->> 'terms'), ''),
    header_image_path = nullif(p_payload ->> 'header_image_path', ''),
    pieces = v_pieces,
    volume_discount_percent = case when v_volume_percent > 0 then v_volume_percent else 0 end,
    customization_total_usd = v_custom_total,
    usd_subtotal = (v_usd ->> 'subtotal')::numeric,
    usd_volume_discount = (v_usd ->> 'volume')::numeric,
    usd_line_discounts = case when v_use_usd then v_usd_line_disc else 0 end,
    usd_discount = (v_usd ->> 'discount')::numeric,
    usd_vat = (v_usd ->> 'vat')::numeric,
    usd_total = (v_usd ->> 'subtotal')::numeric - (v_usd ->> 'volume')::numeric - (v_usd ->> 'discount')::numeric + (v_usd ->> 'vat')::numeric,
    ves_subtotal = (v_ves ->> 'subtotal')::numeric,
    ves_volume_discount = (v_ves ->> 'volume')::numeric,
    ves_line_discounts = case when v_use_ves then v_ves_line_disc else 0 end,
    ves_discount = (v_ves ->> 'discount')::numeric,
    ves_vat = (v_ves ->> 'vat')::numeric,
    ves_total = (v_ves ->> 'subtotal')::numeric - (v_ves ->> 'volume')::numeric - (v_ves ->> 'discount')::numeric + (v_ves ->> 'vat')::numeric,
    ves_total_bs = case when v_use_ves then round(
      ((v_ves ->> 'subtotal')::numeric - (v_ves ->> 'volume')::numeric - (v_ves ->> 'discount')::numeric + (v_ves ->> 'vat')::numeric) * v_ves_rate, 2
    ) else 0 end
  where id = p_quote_id;
end;
$$;

-- Totales de una lista (interna y pura). Subtotal = productos (con descuento por línea) +
-- personalización; al mayor sobre productos; descuento manual sobre lo que queda; IVA al final.
create or replace function public.quote_totals(
  p_used boolean,
  p_products numeric,
  p_line_discounts numeric,
  p_customization numeric,
  p_volume_percent numeric,
  p_discount_type public.discount_type,
  p_discount_value numeric,
  p_vat_enabled boolean,
  p_vat_percent numeric,
  p_is_management boolean,
  p_max_percent numeric
)
returns table (subtotal numeric, volume numeric, discount numeric, vat numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_products numeric := p_products - p_line_discounts;
  v_base numeric;
begin
  if not p_used then
    return query select 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;
  subtotal := v_products + p_customization;
  volume := round(v_products * p_volume_percent / 100, 2);
  v_base := subtotal - volume;
  discount := 0;
  if p_discount_type is not null and coalesce(p_discount_value, 0) > 0 then
    discount := case p_discount_type
      when 'percent' then round(v_base * least(p_discount_value, 100) / 100, 2)
      else round(p_discount_value, 2)
    end;
    if discount > v_base then
      raise exception 'El descuento no puede superar el subtotal.';
    end if;
    if not p_is_management and v_base > 0 and discount / v_base * 100 > p_max_percent + 0.0001 then
      raise exception '%', format('El descuento máximo sin owner o admin es %s%%.', trim_scale(p_max_percent));
    end if;
  end if;
  vat := case when coalesce(p_vat_enabled, false) then round((v_base - discount) * p_vat_percent / 100, 2) else 0 end;
  return next;
end;
$$;

-- Contenido de un presupuesto como payload (interna): para duplicar o crear una versión.
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
    ), '[]')
  )
  from public.quotes q where q.id = p_quote_id;
$$;

-- ============================================================
-- Funciones públicas (todas las acciones pasan por aquí)
-- ============================================================

-- Crea (sin id) o guarda un borrador. Devuelve el id. Todos los roles.
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
  return v_id;
end;
$$;

-- Enviar: el borrador queda congelado. Debe ser de hoy (precios y tasa del día) y tener cliente válido.
create or replace function public.send_quote(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_customer public.customers;
  v_token text;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso para enviar presupuestos.' using errcode = '42501';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'El presupuesto no existe.';
  end if;
  if v_quote.status = 'sent' then
    return v_quote.public_token;
  end if;
  if v_quote.status <> 'draft' then
    raise exception 'Solo se envía un borrador (este está %).', v_quote.status;
  end if;
  if v_quote.issued_on <> public.caracas_today() then
    raise exception 'El borrador es del %: guárdalo de nuevo para actualizar fecha, tasa y precios antes de enviarlo.', to_char(v_quote.issued_on, 'DD/MM/YYYY');
  end if;
  if v_quote.valid_until < public.caracas_today() then
    raise exception 'La fecha de vencimiento ya pasó.';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = p_quote_id) then
    raise exception 'Agrega al menos un producto.';
  end if;
  if v_quote.customer_id is not null then
    select * into v_customer from public.customers where id = v_quote.customer_id;
    if v_customer.blocked_at is not null then
      raise exception 'Cliente bloqueado: no puede recibir presupuestos. Motivo: %', coalesce(v_customer.blocked_reason, '—');
    end if;
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.quotes set public_token = v_token where id = p_quote_id;
  perform public.quote_set_status(p_quote_id, 'sent');
  return v_token;
end;
$$;

-- Aceptado o rechazado: solo un enviado vigente (no vencido, no reemplazado).
create or replace function public.mark_quote(p_quote_id uuid, p_status public.quote_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  if p_status not in ('accepted', 'rejected') then
    raise exception 'Estado inválido.';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'El presupuesto no existe.';
  end if;
  if public.quote_effective_status(v_quote.status, v_quote.valid_until) <> 'sent' then
    raise exception 'Solo un presupuesto enviado y vigente se acepta o rechaza (este está %).',
      public.quote_effective_status(v_quote.status, v_quote.valid_until);
  end if;
  perform public.quote_set_status(p_quote_id, p_status, p_note);
end;
$$;

-- Descartar un borrador que no se va a enviar (no se borra: la numeración no deja huecos).
create or replace function public.discard_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo.';
  end if;
  if not exists (select 1 from public.quotes where id = p_quote_id and status = 'draft' for update) then
    raise exception 'Solo se descarta un borrador.';
  end if;
  perform public.quote_set_status(p_quote_id, 'discarded', p_reason);
end;
$$;

-- Versión nueva de un enviado, rechazado o vencido: borrador con el mismo número (-v2) y el
-- contenido copiado. El anterior queda reemplazado. Solo desde la última versión.
create or replace function public.new_quote_version(p_quote_id uuid)
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
  perform public.quote_apply(v_id, public.quote_payload(v_quote.id));
  update public.quotes set superseded_by = v_id where id = v_quote.id;
  perform public.quote_set_status(v_quote.id, 'superseded', 'Reemplazado por la versión ' || (v_quote.version + 1));
  return v_id;
end;
$$;

-- Duplicar: un borrador nuevo (con número propio) con el mismo contenido, con precios de hoy.
create or replace function public.duplicate_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.quotes where id = p_quote_id) then
    raise exception 'El presupuesto no existe.';
  end if;
  v_id := public.quote_new_draft(null, 1, null, p_quote_id);
  perform public.quote_apply(v_id, public.quote_payload(p_quote_id));
  return v_id;
end;
$$;

-- Registro diario: los enviados cuya fecha pasó quedan vencidos (lo llama el cron).
create or replace function public.expire_quotes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote record;
  v_count integer := 0;
begin
  for v_quote in
    select id from public.quotes where status = 'sent' and valid_until < public.caracas_today() for update
  loop
    perform public.quote_set_status(v_quote.id, 'expired', 'Venció la fecha');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ============================================================
-- RLS y permisos
-- ============================================================

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_item_customizations enable row level security;
alter table public.quote_status_events enable row level security;

create policy "quotes: todo el equipo los ve" on public.quotes for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "quote_items: todo el equipo los ve" on public.quote_items for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "quote_item_customizations: todo el equipo los ve" on public.quote_item_customizations for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));
create policy "quote_status_events: todo el equipo los ve" on public.quote_status_events for select to authenticated
  using (public.has_role(array['owner', 'admin', 'staff']::public.app_role[]));

-- Nadie escribe directo: todo pasa por las funciones de arriba.
revoke all on table public.quotes, public.quote_items, public.quote_item_customizations, public.quote_status_events
  from anon, authenticated;
grant select on table public.quotes, public.quote_items, public.quote_item_customizations, public.quote_status_events,
  public.quotes_overview to authenticated;

revoke all on function public.quote_settings_audit() from public, anon, authenticated;
revoke all on function public.quotes_guard() from public, anon, authenticated;
revoke all on function public.quote_lines_guard() from public, anon, authenticated;
revoke all on function public.quote_set_status(uuid, public.quote_status, text) from public, anon, authenticated;
revoke all on function public.quote_new_draft(integer, integer, uuid, uuid) from public, anon, authenticated;
revoke all on function public.quote_apply(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.quote_payload(uuid) from public, anon, authenticated;
revoke all on function public.quote_totals(boolean, numeric, numeric, numeric, numeric, public.discount_type, numeric, boolean, numeric, boolean, numeric)
  from public, anon, authenticated;

revoke all on function public.save_quote_draft(uuid, jsonb) from public, anon;
revoke all on function public.send_quote(uuid) from public, anon;
revoke all on function public.mark_quote(uuid, public.quote_status, text) from public, anon;
revoke all on function public.discard_quote(uuid, text) from public, anon;
revoke all on function public.new_quote_version(uuid) from public, anon;
revoke all on function public.duplicate_quote(uuid) from public, anon;
grant execute on function public.save_quote_draft(uuid, jsonb) to authenticated;
grant execute on function public.send_quote(uuid) to authenticated;
grant execute on function public.mark_quote(uuid, public.quote_status, text) to authenticated;
grant execute on function public.discard_quote(uuid, text) to authenticated;
grant execute on function public.new_quote_version(uuid) to authenticated;
grant execute on function public.duplicate_quote(uuid) to authenticated;

revoke all on function public.expire_quotes() from public, anon, authenticated;
grant execute on function public.expire_quotes() to service_role;
