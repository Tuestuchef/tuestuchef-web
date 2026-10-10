-- Elegir el estado de una línea en vez de avanzar uno por uno.
-- · Hacia adelante: cualquiera del equipo elige cualquier estado posterior (en un pedido, entre las
--   etapas que aplican a la línea; "entregado" sigue siendo del pedido completo).
-- · Hacia atrás: solo owner o admin, con motivo (si alguien se equivocó). Lo consumido no vuelve.
-- · Saltar el corte igual consume la materia prima. Las etapas saltadas no generan destajo: sus
--   asignaciones abiertas se cierran sin piezas.
-- · Entregar un pedido ya no exige que todas las líneas estén listas: las que falten pasan a entregadas.

create or replace function public.set_sale_item_status(
  p_sale_item_id uuid,
  p_status public.sale_item_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.sale_items;
  v_current public.sale_item_status;
  v_order public.orders;
  v_is_order boolean;
  v_assignment public.production_assignments;
  v_member public.team_members;
  v_rate numeric;
  v_category uuid;
  v_pieces numeric;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_item from public.sale_items where id = p_sale_item_id for update;
  if not found then
    raise exception 'La línea no existe.';
  end if;
  if v_item.source = 'combo' then
    raise exception 'El estado se cambia en cada componente del combo.';
  end if;
  if exists (select 1 from public.sale_voids where sale_id = v_item.sale_id) then
    raise exception 'La venta está anulada.';
  end if;
  if exists (select 1 from public.order_cancellations where sale_id = v_item.sale_id) then
    raise exception 'El pedido está cancelado.';
  end if;
  select status into v_current from public.sale_item_current_status where sale_item_id = p_sale_item_id;
  if p_status = v_current then
    raise exception 'La línea ya está en "%".', p_status;
  end if;

  select * into v_order from public.orders where sale_id = v_item.sale_id;
  v_is_order := found;

  if v_is_order and p_status not in ('to_produce', 'ready', 'delivered')
     and not public.line_stage_applies(v_item, p_status) then
    raise exception 'Esa etapa no aplica a esta línea.';
  end if;

  -- Hacia atrás: owner o admin, con motivo. Si el pedido estaba entregado, deja de estarlo.
  if v_current is not null and p_status < v_current then
    if not public.has_role(array['owner', 'admin']::public.app_role[]) then
      raise exception 'Solo owner o admin pueden volver a un estado anterior.' using errcode = '42501';
    end if;
    if length(trim(coalesce(p_note, ''))) < 3 then
      raise exception 'Indica el motivo para volver a un estado anterior.';
    end if;
    if v_is_order and v_order.delivered_at is not null then
      perform set_config('app.delivering_order', v_order.sale_id::text, true);
      update public.orders set delivered_at = null where sale_id = v_order.sale_id;
      perform set_config('app.delivering_order', '', true);
    end if;
    insert into public.sale_item_status_events (sale_item_id, status, note)
    values (p_sale_item_id, p_status, trim(p_note));
    return;
  end if;

  if not v_is_order then
    -- Venta normal: cualquier estado posterior.
    if v_item.source = 'made_to_order' and p_status in ('ready', 'delivered') then
      perform public.consume_for_sale_item(p_sale_item_id);
    end if;
    insert into public.sale_item_status_events (sale_item_id, status, note)
    values (p_sale_item_id, p_status, nullif(trim(p_note), ''));
    return;
  end if;

  -- Pedido.
  if p_status = 'delivered' and coalesce(current_setting('app.delivering_order', true), '') <> v_order.sale_id::text then
    raise exception 'Se entrega el pedido completo, no línea por línea.';
  end if;

  -- Para empezar a producir hace falta el abono (o una excepción). Al entregar ya lo resolvió el pedido.
  if v_current = 'to_produce' and p_status <> 'delivered'
     and public.sale_paid_usd(v_order.sale_id) + 0.01 < v_order.deposit_required_usd
     and not exists (select 1 from public.order_overrides where sale_id = v_order.sale_id and kind = 'start_without_deposit') then
    raise exception 'Falta el abono para empezar: se requieren % USD y se han pagado %.',
      trim_scale(v_order.deposit_required_usd), trim_scale(round(public.sale_paid_usd(v_order.sale_id), 2));
  end if;

  -- Pasado el corte (terminado o saltado) se consume la materia prima (una sola vez).
  if p_status > 'cutting' then
    perform public.consume_for_sale_item(p_sale_item_id);
  end if;

  -- La etapa actual termina: su asignación se completa y, a destajo, se cuentan las piezas.
  if v_current in ('cutting', 'sewing', 'customization', 'quality_check', 'packing') then
    select * into v_assignment from public.production_assignments
    where sale_item_id = p_sale_item_id and stage = v_current and completed_at is null;
    if found then
      v_pieces := public.line_stage_pieces(v_item, v_current);
      update public.production_assignments set completed_at = now(), pieces = v_pieces where id = v_assignment.id;
      if v_assignment.team_member_id is not null then
        select * into v_member from public.team_members where id = v_assignment.team_member_id;
        if v_member.pay_basis in ('piecework', 'both') then
          select p.category_id into v_category
          from public.product_variants v join public.products p on p.id = v.product_id
          where v.id = v_item.variant_id;
          select rate_usd into v_rate from public.piece_rates
          where product_category_id = v_category and stage = v_current and effective_from <= public.caracas_today()
          order by effective_from desc limit 1;
          if v_rate is not null then
            insert into public.piecework_entries
              (team_member_id, assignment_id, sale_item_id, stage, pieces, rate_usd, amount_usd, completed_at)
            values (v_member.id, v_assignment.id, p_sale_item_id, v_current, v_pieces, v_rate, round(v_pieces * v_rate, 2), now());
          end if;
        end if;
      end if;
    end if;
  end if;

  -- Las etapas saltadas no se hicieron aquí: sus asignaciones abiertas se cierran sin piezas.
  update public.production_assignments
  set completed_at = now()
  where sale_item_id = p_sale_item_id and completed_at is null
    and stage > coalesce(v_current, 'to_produce') and stage < p_status;

  insert into public.sale_item_status_events (sale_item_id, status, note)
  values (p_sale_item_id, p_status, nullif(trim(p_note), ''));
end;
$$;

-- Entregar el pedido: las líneas que no estaban listas pasan directo a entregadas.
create or replace function public.deliver_order(p_sale_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_total numeric;
  v_balance numeric;
  v_item record;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where sale_id = p_sale_id for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_order.delivered_at is not null then
    raise exception 'El pedido ya fue entregado.';
  end if;
  if exists (select 1 from public.order_cancellations where sale_id = p_sale_id) then
    raise exception 'El pedido está cancelado.';
  end if;

  select total_usd into v_total from public.sales where id = p_sale_id;
  v_balance := v_total - public.sale_paid_usd(p_sale_id);
  if v_balance > 0.01 then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Queda un saldo de % USD: registra el pago antes de entregar.', trim_scale(round(v_balance, 2));
    end if;
    if not public.has_role(array['owner', 'admin']::public.app_role[]) then
      raise exception 'Con saldo pendiente, solo owner o admin confirman la entrega.' using errcode = '42501';
    end if;
    insert into public.order_overrides (sale_id, kind, reason) values (p_sale_id, 'deliver_with_balance', trim(p_reason))
    on conflict (sale_id, kind) do nothing;
  end if;

  perform set_config('app.delivering_order', p_sale_id::text, true);
  for v_item in
    select i.id from public.sale_items i
    left join public.sale_item_current_status cs on cs.sale_item_id = i.id
    where i.sale_id = p_sale_id and i.source <> 'combo' and cs.status is distinct from 'delivered'
  loop
    perform public.set_sale_item_status(v_item.id, 'delivered');
  end loop;
  update public.orders set delivered_at = now() where sale_id = p_sale_id;
  perform set_config('app.delivering_order', '', true);
end;
$$;
