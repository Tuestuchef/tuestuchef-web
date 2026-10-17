-- Venta registrada como "Ya se entregó": todas sus líneas quedan entregadas, también las que iban
-- por encargo (antes quedaban "Por producir"). Lo que se fabricó consume su materia prima, como al
-- marcarla entregada después. Un pedido no cambia: empieza por producir y se entrega completo.

create or replace function public.sale_line_after_insert(
  p_item_id uuid,
  p_line jsonb,
  p_occurred_at timestamptz,
  p_delivered boolean,
  p_is_order boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_stock numeric := case p_line ->> 'source'
    when 'stock' then (p_line ->> 'quantity')::numeric
    else coalesce((p_line ->> 'reserved_quantity')::numeric, 0)
  end;
  v_status public.sale_item_status := case
    when p_is_order then 'to_produce'
    when p_delivered then 'delivered'
    when p_line ->> 'source' = 'made_to_order' then 'to_produce'
    else 'ready'
  end;
begin
  -- Lo que sale del inventario: la línea completa si es de stock, o las piezas apartadas.
  if v_from_stock > 0 then
    insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, sale_item_id, occurred_at)
    values ((p_line ->> 'variant_id')::uuid, 'sale', -v_from_stock, (p_line ->> 'cost')::numeric, p_item_id, p_occurred_at);
  end if;

  -- Por encargo y ya entregado: se fabricó, así que consume la materia prima (una sola vez).
  if v_status = 'delivered' and p_line ->> 'source' = 'made_to_order' then
    perform public.consume_for_sale_item(p_item_id);
  end if;

  insert into public.sale_item_status_events (sale_item_id, status)
  values (p_item_id, v_status);
end;
$$;
