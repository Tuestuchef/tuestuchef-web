-- Código del modelo: distingue en el SKU productos de la misma categoría, género, cierre y corte
-- (manga corta / 3/4 / larga; estuche Maxi / Stark / Pocket).
-- SKU: CATEGORÍA-MODELO-GÉNERO-CIERRE-CORTE-COLOR-TALLA (ej.: FIL-MC-BR-NEG-S).
-- Opcional; como los demás códigos, solo se usa al crear variantes: cambiarlo no toca los SKU existentes.
alter table public.products
  add column model_code text,
  add constraint products_model_code_format check (model_code is null or model_code ~ '^[A-Z0-9]{1,6}$');

comment on column public.products.model_code is 'Código del modelo para el SKU (1 a 6 letras o números en mayúscula).';

-- Las columnas de products se otorgan una por una: owner y admin la escriben (RLS decide quién).
grant insert (model_code), update (model_code) on public.products to authenticated;
