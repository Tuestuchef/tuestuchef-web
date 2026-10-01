-- Fase 2: valores nuevos de enums. Van solos en su migración porque Postgres no deja
-- usar un valor de enum en la misma transacción en que se agrega.

-- Anular una compra devuelve lo que entró (salida de stock).
alter type public.stock_movement_type add value if not exists 'purchase_reversal';
-- Producción: consumo de materia prima según la receta (módulo de costos).
alter type public.stock_movement_type add value if not exists 'consumption';

-- Pagos a proveedores (salen del libro desde el módulo de compras).
alter type public.ledger_entry_type add value if not exists 'purchase_payment';

-- Tasa con la que se convierte un pago a proveedor en Bs.
create type public.supplier_rate_kind as enum ('bcv_usd', 'parallel', 'none');

-- Línea de compra: mercancía con stock, o concepto sin stock (servicio, alquiler, maquila…).
create type public.purchase_line_type as enum ('inventory', 'concept');
