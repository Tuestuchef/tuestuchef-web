-- Datos de la empresa (antes "Datos del negocio"): se suman nombre comercial, razón social,
-- sitio web e imagen de encabezado para presupuestos y recibos. La imagen vive en el bucket
-- público de R2; aquí solo se guarda su ruta.

alter table public.business_profile
  add column trade_name text check (trade_name is null or length(trim(trade_name)) between 1 and 80),
  add column legal_name text check (legal_name is null or length(trim(legal_name)) between 1 and 150),
  add column website text check (website is null or website ~ '^https://[^\s]{3,200}$'),
  add column header_image_path text check (
    header_image_path is null or header_image_path ~ '^brand/header/[0-9a-f-]{36}\.(png|jpg)$'
  );

update public.business_profile set trade_name = 'Tuestuchef';

grant update (trade_name, legal_name, website, header_image_path) on public.business_profile to authenticated;
