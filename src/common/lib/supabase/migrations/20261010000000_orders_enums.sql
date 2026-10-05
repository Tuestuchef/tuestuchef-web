-- Fase 3, paso 2: enums de pedidos y producción (en su propia migración: un valor nuevo de enum
-- no se puede usar en la misma transacción en que se agrega).

-- Etapas de producción, en orden. El enum de estados de línea se amplía en su lugar:
-- 'in_production' pasa a ser 'sewing' (confección) y las filas existentes quedan así.
alter type public.sale_item_status rename value 'in_production' to 'sewing';
alter type public.sale_item_status add value if not exists 'cutting' before 'sewing';
alter type public.sale_item_status add value if not exists 'customization' after 'sewing';
alter type public.sale_item_status add value if not exists 'quality_check' after 'customization';
alter type public.sale_item_status add value if not exists 'packing' after 'quality_check';

-- Reembolso de un pago de venta (cancelación de pedido): misma moneda y cuenta que el pago.
alter type public.ledger_entry_type add value if not exists 'sale_refund';

create type public.supplier_kind as enum ('goods', 'workshop');
create type public.order_stock_mode as enum ('reserve_and_produce', 'produce_all');
create type public.pay_basis as enum ('salary', 'piecework', 'both');
create type public.customer_block_action as enum ('block', 'unblock');
create type public.order_override_kind as enum ('start_without_deposit', 'deliver_with_balance');
