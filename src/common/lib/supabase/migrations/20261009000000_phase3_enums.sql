-- Fase 3, paso 1: valores nuevos de enums. Van en su propia migración porque Postgres no deja
-- usar un valor de enum recién agregado dentro de la misma transacción.

-- Combo: producto que agrupa otros (p. ej. Combo Escuela) con precio propio.
alter type public.product_kind add value if not exists 'combo';

-- Línea de venta de un combo: lleva el precio; sus componentes son líneas hijas.
alter type public.sale_line_source add value if not exists 'combo';

-- Descuento al mayor: tramos para productos o para personalización.
create type public.volume_discount_scope as enum ('products', 'customization');
