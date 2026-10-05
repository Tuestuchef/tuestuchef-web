-- Clientes persona o empresa (presupuestos, paso 1).
--
-- Empresa: razón social obligatoria (es su requisito mínimo: no necesita teléfono, correo ni
-- Instagram), RIF visible para todo el equipo (va en presupuestos) y persona de contacto.
-- Persona: igual que antes (nombre y al menos un contacto); su cédula sigue protegida en
-- customer_private. La dirección sirve para ambos.
-- En una empresa, first_name es el nombre con el que se la conoce (o la razón social).

create type public.customer_kind as enum ('person', 'company');

alter table public.customers
  add column kind public.customer_kind not null default 'person',
  add column legal_name text check (legal_name is null or length(trim(legal_name)) between 1 and 150),
  add column tax_id text unique check (tax_id is null or tax_id ~ '^[VEJPG][0-9]{5,10}$'),
  add column contact_person text check (contact_person is null or length(trim(contact_person)) between 1 and 100),
  add column address text check (address is null or length(trim(address)) between 1 and 300);

alter table public.customers drop constraint customers_contact_required;
alter table public.customers
  add constraint customers_contact_required check (kind = 'company' or num_nonnulls(phone, email, instagram) >= 1),
  add constraint customers_company_legal_name check (kind <> 'company' or legal_name is not null),
  -- Razón social, RIF y contacto son de empresas; el documento de una persona es su cédula (privada).
  add constraint customers_company_fields check (
    kind = 'company' or (legal_name is null and tax_id is null and contact_person is null)
  );

grant insert (kind, legal_name, tax_id, contact_person, address),
      update (kind, legal_name, tax_id, contact_person, address)
  on public.customers to authenticated;
