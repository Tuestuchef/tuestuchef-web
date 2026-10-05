-- Presupuestos, paso 6 (tipos): el IVA cobrado como tipo propio en los resúmenes de utilidad.
-- No es una categoría que se use al registrar: lo calcula la base al separar el IVA de los cobros.
-- Va aparte porque un valor nuevo de un enum no se puede usar en la misma transacción.

alter type public.category_type add value if not exists 'vat_collected';
