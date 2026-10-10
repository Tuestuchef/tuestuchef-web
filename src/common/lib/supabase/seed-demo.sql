-- ============================================================================
-- SEED DEMO · solo para tuestuchef-demo (staging). NUNCA en producción.
-- ============================================================================
-- Un mes de operación realista para probar el dashboard: tasas diarias, cuentas,
-- catálogo con materia prima y recetas, compras (contado y crédito), producción,
-- ~60 ventas (abonos, pendientes, descuentos, encargos, una anulada), gastos,
-- sueldos con adelantos, un retiro, una reinversión, un cambio Bs→USDT y la reserva.
--
-- Cómo correrlo (SQL Editor del proyecto tuestuchef-demo, o por la CLI enlazada a demo):
--   1. La primera línea DEBE ser:  select set_config('app.demo_seed', 'tuestuchef-demo', false);
--   2. Debajo, el contenido de este archivo.
--
-- Protecciones:
--   - Sin esa confirmación, no hace nada.
--   - Si la base ya tiene ventas o compras, no hace nada (no se mezcla con datos reales).
--   - Necesita un owner activo (el de staging): todo queda registrado a su nombre.
--   - Todo pasa por las funciones de la app (create_sale, create_purchase, register_production,
--     nómina…): se aplican las mismas reglas, tasas de cada fecha y RLS de negocio.
--   - Al final, las fechas de registro (created_at) se igualan a las de los hechos para que el
--     demo no aparezca entero como "retroactivo". Es lo único que el seed hace saltándose la
--     inmutabilidad, y solo sobre lo que acaba de crear.
-- ============================================================================

do $seed$
declare
  v_owner uuid;
  v_today date := public.caracas_today();
  d integer;
  i integer;
  -- Cuentas, métodos y categorías
  a_bank uuid; a_cash uuid; a_zelle uuid; a_binance uuid; a_reserve uuid;
  m_mobile uuid; m_cash uuid; m_zelle uuid; m_usdt uuid;
  c_sales uuid; c_materials uuid; c_maquila uuid; c_rent uuid; c_ads uuid; c_services uuid;
  c_salary uuid; c_withdrawal uuid; c_reinvest uuid; c_tax uuid; c_capital uuid;
  -- Catálogo
  cat_fil uuid; cat_del uuid; cat_gor uuid; cat_pan uuid; cat_ins uuid;
  col_neg uuid; col_bla uuid; col_vin uuid;
  sz_s uuid; sz_m uuid; sz_l uuid;
  p_fabric uuid; p_buttons uuid; p_filipina uuid; p_apron uuid; p_cap uuid; p_pants uuid;
  v_fabric_neg uuid; v_fabric_bla uuid; v_fabric_vin uuid; v_buttons uuid;
  s_textiles uuid; s_buttons uuid; s_embroidery uuid;
  t_owner uuid; t_maria uuid; t_jose uuid;
  -- Ventas
  v_variants uuid[];
  v_customers uuid[];
  v_methods uuid[];
  v_sale uuid;
  v_total numeric;
  v_method uuid;
  v_kind public.payment_rate_kind;
  v_currency public.currency;
  v_rate public.exchange_rates;
  v_variant uuid;
  v_source text;
  v_ff public.fulfillment_type;
  v_pick double precision;
  v_at timestamptz;
  v_purchase uuid;
  v_item uuid;
  v_advance_ids uuid[] := '{}';
  v_partial uuid[] := '{}';
  v_mto_items uuid[] := '{}';
  v_x uuid;
  v_skipped integer := 0;
  v_bcv numeric;
  v_eur numeric;
  v_binance numeric;
begin
  -- ---------------------------------------------------------------- protecciones
  if coalesce(current_setting('app.demo_seed', true), '') <> 'tuestuchef-demo' then
    raise exception 'Seed demo: falta la confirmación. Ejecuta primero  select set_config(''app.demo_seed'', ''tuestuchef-demo'', false);  y SOLO en el proyecto tuestuchef-demo.';
  end if;
  if exists (select 1 from public.sales) or exists (select 1 from public.purchases) then
    raise exception 'Seed demo: la base ya tiene ventas o compras. No se ejecuta sobre datos existentes.';
  end if;
  select id into v_owner from public.profiles where role = 'owner' and is_active order by created_at limit 1;
  if v_owner is null then
    raise exception 'Seed demo: crea primero el owner de staging (npm run create-first-owner:demo).';
  end if;

  -- Actúa como el owner con 2FA (aal2): las funciones validan rol y registran autoría.
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform setseed(0.42);

  -- ---------------------------------------------------------------- tasas (31 días)
  -- Parte de la última tasa registrada (si ya hay tasas reales en staging) y hacia atrás baja
  -- ~6% el BCV y ~12% el paralelo en el mes. Las fechas que ya tienen tasa no se tocan.
  select * into v_rate from public.exchange_rates order by rate_date desc, created_at desc limit 1;
  v_bcv := coalesce(v_rate.bcv_usd, 41.20);
  v_eur := coalesce(v_rate.bcv_eur, 44.80);
  v_binance := coalesce(v_rate.binance_usdt, 53.50);
  for d in reverse 30..0 loop
    continue when exists (
      select 1 from public.exchange_rates
      where created_at < now()
        and (rate_date = v_today - d or (created_at at time zone 'America/Caracas')::date = v_today - d)
    );
    insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt, usd_usdt, note)
    values (
      v_today - d,
      round(v_bcv * (1 - d * 0.002), 4),
      round(v_eur * (1 - d * 0.002), 4),
      round(v_binance * (1 - d * 0.004 + (random() - 0.5) * 0.01)::numeric, 4),
      1,
      'Demo'
    );
  end loop;

  -- ---------------------------------------------------------------- cuentas y métodos
  insert into public.accounts (name, currency, kind) values
    ('Banco Venezuela', 'VES', 'bank'), ('Efectivo USD', 'USD', 'cash'), ('Zelle', 'USD', 'zelle'),
    ('Binance', 'USDT', 'crypto_wallet'), ('Reserva', 'USDT', 'crypto_wallet')
  on conflict (name) do nothing;
  select id into a_bank from public.accounts where name = 'Banco Venezuela';
  select id into a_cash from public.accounts where name = 'Efectivo USD';
  select id into a_zelle from public.accounts where name = 'Zelle';
  select id into a_binance from public.accounts where name = 'Binance';
  select id into a_reserve from public.accounts where name = 'Reserva';

  insert into public.payment_methods (name, account_id, price_currency, rate_kind, sort_order) values
    ('Pago móvil', a_bank, 'USD', 'bcv_usd', 1), ('Efectivo', a_cash, 'USD', 'none', 2),
    ('Zelle', a_zelle, 'USD', 'none', 3), ('USDT', a_binance, 'USD', 'none', 4)
  on conflict (name) do nothing;
  select id into m_mobile from public.payment_methods where name = 'Pago móvil';
  select id into m_cash from public.payment_methods where name = 'Efectivo';
  select id into m_zelle from public.payment_methods where name = 'Zelle';
  select id into m_usdt from public.payment_methods where name = 'USDT';

  -- ---------------------------------------------------------------- categorías de dinero
  insert into public.movement_categories (name, type) values
    ('Telas e insumos', 'cost'), ('Maquila', 'cost'), ('Alquiler', 'operating_expense'),
    ('Publicidad', 'operating_expense'), ('Servicios', 'operating_expense'), ('Sueldos', 'salary'),
    ('Retiros', 'withdrawal'), ('Reinversión', 'reinvestment'), ('Impuestos', 'tax'),
    ('Aporte de capital', 'capital_contribution')
  on conflict (name) do nothing;
  select id into c_sales from public.movement_categories where is_system and type = 'sales';
  select id into c_materials from public.movement_categories where name = 'Telas e insumos';
  select id into c_maquila from public.movement_categories where name = 'Maquila';
  select id into c_rent from public.movement_categories where name = 'Alquiler';
  select id into c_ads from public.movement_categories where name = 'Publicidad';
  select id into c_services from public.movement_categories where name = 'Servicios';
  select id into c_salary from public.movement_categories where name = 'Sueldos';
  select id into c_withdrawal from public.movement_categories where name = 'Retiros';
  select id into c_reinvest from public.movement_categories where name = 'Reinversión';
  select id into c_tax from public.movement_categories where name = 'Impuestos';
  select id into c_capital from public.movement_categories where name = 'Aporte de capital';

  -- ---------------------------------------------------------------- equipo
  select id into t_owner from public.team_members where profile_id = v_owner;
  if t_owner is null then
    insert into public.team_members (full_name, profile_id, job_title)
    select coalesce(nullif(full_name, ''), 'Dueño'), id, 'Dueño' from public.profiles where id = v_owner
    returning id into t_owner;
  end if;
  insert into public.team_members (full_name, job_title, phone) values ('María Rodríguez', 'Costurera', '+584141112233')
    returning id into t_maria;
  insert into public.team_members (full_name, job_title) values ('José Pérez', 'Ventas y despacho')
    returning id into t_jose;
  insert into public.salary_agreements (team_member_id, amount, currency, frequency, effective_from, notes) values
    (t_owner, 400, 'USD', 'monthly', v_today - 60, 'Sueldo del dueño'),
    (t_maria, 150, 'USD', 'biweekly', v_today - 60, null),
    (t_jose, 120, 'USD', 'biweekly', v_today - 60, null);

  -- Aporte inicial (hace 30 días): cada cuenta arranca con saldo.
  v_at := (v_today - 30)::timestamp at time zone 'America/Caracas' + interval '9 hours';
  insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, description, team_member_id) values
    (a_bank, 'income', c_capital, round(2500 * (public.exchange_rate_for_date(v_today - 30)).binance_usdt, 2), v_at, 'Aporte inicial', t_owner),
    (a_cash, 'income', c_capital, 1500, v_at, 'Aporte inicial', t_owner),
    (a_binance, 'income', c_capital, 3000, v_at, 'Aporte inicial', t_owner);

  -- ---------------------------------------------------------------- catálogo
  insert into public.product_categories (name, code, sort_order) values
    ('Filipinas', 'FIL', 1), ('Delantales', 'DEL', 2), ('Gorros', 'GOR', 3), ('Pantalones', 'PAN', 4), ('Insumos', 'INS', 9)
  on conflict (code) do nothing;
  select id into cat_fil from public.product_categories where code = 'FIL';
  select id into cat_del from public.product_categories where code = 'DEL';
  select id into cat_gor from public.product_categories where code = 'GOR';
  select id into cat_pan from public.product_categories where code = 'PAN';
  select id into cat_ins from public.product_categories where code = 'INS';

  insert into public.colors (name, code, sort_order) values ('Negro', 'NEG', 1), ('Blanco', 'BLA', 2), ('Vinotinta', 'VIN', 3)
  on conflict (code) do nothing;
  select id into col_neg from public.colors where code = 'NEG';
  select id into col_bla from public.colors where code = 'BLA';
  select id into col_vin from public.colors where code = 'VIN';
  select id into sz_s from public.sizes where code = 'S';
  select id into sz_m from public.sizes where code = 'M';
  select id into sz_l from public.sizes where code = 'L';

  -- Materia prima
  insert into public.products (category_id, name, kind, unit, fulfillment_type)
    values (cat_ins, 'Tela antifluido', 'raw_material', 'meter', 'stock') returning id into p_fabric;
  insert into public.product_variants (product_id, color_id, sku) values (p_fabric, col_neg, 'INS-TEL-NEG') returning id into v_fabric_neg;
  insert into public.product_variants (product_id, color_id, sku) values (p_fabric, col_bla, 'INS-TEL-BLA') returning id into v_fabric_bla;
  insert into public.product_variants (product_id, color_id, sku) values (p_fabric, col_vin, 'INS-TEL-VIN') returning id into v_fabric_vin;
  insert into public.products (category_id, name, kind, unit, fulfillment_type)
    values (cat_ins, 'Botones de presión', 'raw_material', 'unit', 'stock') returning id into p_buttons;
  insert into public.product_variants (product_id, sku) values (p_buttons, 'INS-BOT') returning id into v_buttons;

  -- Productos terminados
  insert into public.products (category_id, name, fulfillment_type, genders, closure, labor_cost_usdt)
    values (cat_fil, 'Filipina dama broche', 'stock', '{women}', 'snap', 4) returning id into p_filipina;
  insert into public.products (category_id, name, fulfillment_type, labor_cost_usdt)
    values (cat_del, 'Delantal con bolsillos', 'stock', 1.5) returning id into p_apron;
  insert into public.products (category_id, name, fulfillment_type, labor_cost_usdt)
    values (cat_gor, 'Gorro bordado', 'made_to_order', 2) returning id into p_cap;
  insert into public.products (category_id, name, fulfillment_type, fit, labor_cost_usdt)
    values (cat_pan, 'Pantalón jogger', 'stock', 'jogger', 3) returning id into p_pants;

  insert into public.product_variants (product_id, gender, color_id, size_id, sku)
  select p_filipina, 'women', c.id, s.id, 'FIL-D-BR-' || c.code || '-' || s.code
  from public.colors c cross join public.sizes s
  where c.code in ('NEG', 'BLA', 'VIN') and s.code in ('S', 'M', 'L');
  insert into public.product_variants (product_id, color_id, sku)
  select p_apron, c.id, 'DEL-' || c.code from public.colors c where c.code in ('NEG', 'BLA', 'VIN');
  insert into public.product_variants (product_id, color_id, sku)
  select p_cap, c.id, 'GOR-' || c.code from public.colors c where c.code in ('NEG', 'BLA');
  insert into public.product_variants (product_id, color_id, size_id, sku)
  select p_pants, col_neg, s.id, 'PAN-JG-NEG-' || s.code from public.sizes s where s.code in ('S', 'M', 'L');

  -- Recetas: tela del color de la prenda (más en L) + botones.
  insert into public.product_recipe_lines (product_id, raw_product_id, size_id, quantity) values
    (p_filipina, p_fabric, null, 1.6), (p_filipina, p_fabric, sz_l, 1.8),
    (p_apron, p_fabric, null, 0.8), (p_cap, p_fabric, null, 0.5);
  insert into public.product_recipe_lines (product_id, raw_variant_id, quantity) values (p_filipina, v_buttons, 8);

  -- Precios (USD de referencia por método)
  insert into public.product_prices (product_id, payment_method_id, amount_usd)
  select p.id, m.id, x.price
  from (values
    (p_filipina, 'Pago móvil', 28), (p_filipina, 'Efectivo', 25), (p_filipina, 'Zelle', 26), (p_filipina, 'USDT', 25),
    (p_apron, 'Pago móvil', 14), (p_apron, 'Efectivo', 12), (p_apron, 'Zelle', 13), (p_apron, 'USDT', 12),
    (p_cap, 'Pago móvil', 10), (p_cap, 'Efectivo', 9), (p_cap, 'Zelle', 9), (p_cap, 'USDT', 9),
    (p_pants, 'Pago móvil', 22), (p_pants, 'Efectivo', 20), (p_pants, 'Zelle', 21), (p_pants, 'USDT', 20)
  ) as x(product_id, method, price)
  join public.products p on p.id = x.product_id
  join public.payment_methods m on m.name = x.method;

  -- Clientes
  insert into public.customers (first_name, last_name, phone, instagram) values
    ('Ana', 'González', '+584141230001', null), ('Luis', 'Martínez', '+584241230002', 'chefluis'),
    ('Carla', 'Díaz', '+584121230003', null), ('Pedro', 'Ramírez', null, 'pedro.cocina'),
    ('Sofía', 'Herrera', '+584161230005', null), ('Restaurante', 'La Sazón', '+584141230006', 'lasazon.ccs'),
    ('Miguel', 'Torres', '+584241230007', null), ('Valentina', 'Rojas', '+584121230008', 'vale.pasteleria'),
    ('Escuela', 'Gastronómica Ávila', '+582125550009', null), ('Daniel', 'Castro', '+584141230010', null),
    ('Gabriela', 'Moreno', null, 'gaby.chef'), ('Andrés', 'Silva', '+584261230012', null);
  select array_agg(id) into v_customers from public.customers;

  -- Proveedores
  insert into public.suppliers (name, rif, contact_name, phone) values
    ('Textiles Caracas', 'J401234567', 'Sr. Ramírez', '+584141119999') returning id into s_textiles;
  insert into public.suppliers (name, contact_name) values ('Botones El Rey', 'Carmen') returning id into s_buttons;
  insert into public.suppliers (name, contact_name) values ('Bordados Express', 'Luis') returning id into s_embroidery;

  -- ---------------------------------------------------------------- compras y producción
  -- Día −29: tela (contado, Bs a tasa paralela) y botones (efectivo).
  v_at := (v_today - 29)::timestamp at time zone 'America/Caracas' + interval '10 hours';
  select * into v_rate from public.exchange_rate_for_date(v_today - 29);
  perform public.create_purchase(
    s_textiles,
    jsonb_build_array(
      jsonb_build_object('line_type', 'inventory', 'variant_id', v_fabric_neg, 'quantity', 55, 'unit_cost_usd', 4.5, 'category_id', c_materials),
      jsonb_build_object('line_type', 'inventory', 'variant_id', v_fabric_bla, 'quantity', 45, 'unit_cost_usd', 4.5, 'category_id', c_materials),
      jsonb_build_object('line_type', 'inventory', 'variant_id', v_fabric_vin, 'quantity', 40, 'unit_cost_usd', 4.8, 'category_id', c_materials)
    ),
    jsonb_build_array(jsonb_build_object('account_id', a_bank, 'rate_kind', 'parallel',
      'amount', round((55 * 4.5 + 45 * 4.5 + 40 * 4.8) * v_rate.binance_usdt, 2))),
    null, 'Factura 00123', null, v_at
  );
  perform public.create_purchase(
    s_buttons,
    jsonb_build_array(jsonb_build_object('line_type', 'inventory', 'variant_id', v_buttons, 'quantity', 700, 'unit_cost_usd', 0.08, 'category_id', c_materials)),
    jsonb_build_array(jsonb_build_object('account_id', a_cash, 'amount', 56)),
    null, null, null, v_at
  );
  -- Pantalones: mercancía de reventa, carga inicial con costo.
  insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, occurred_at)
  select v.id, 'initial_count', 12, 9, v_at from public.product_variants v where v.product_id = p_pants;

  -- Producción: día −27 filipinas (5 por variante) y delantales (10 por color).
  v_at := (v_today - 27)::timestamp at time zone 'America/Caracas' + interval '15 hours';
  for v_x in select id from public.product_variants where product_id = p_filipina loop
    perform public.register_production(v_x, 5, null, 'Lote 1', v_at);
  end loop;
  for v_x in select id from public.product_variants where product_id = p_apron loop
    perform public.register_production(v_x, 10, null, 'Lote 1', v_at);
  end loop;

  -- Día −15: segunda compra de tela, a crédito (vence en 15 días), con abono de la mitad a tasa BCV.
  v_at := (v_today - 15)::timestamp at time zone 'America/Caracas' + interval '11 hours';
  v_purchase := public.create_purchase(
    s_textiles,
    jsonb_build_array(
      jsonb_build_object('line_type', 'inventory', 'variant_id', v_fabric_neg, 'quantity', 30, 'unit_cost_usd', 4.7, 'category_id', c_materials),
      jsonb_build_object('line_type', 'inventory', 'variant_id', v_fabric_bla, 'quantity', 30, 'unit_cost_usd', 4.7, 'category_id', c_materials)
    ),
    '[]'::jsonb, v_today, 'Factura 00188 · crédito', null, v_at
  );
  select * into v_rate from public.exchange_rate_for_date(v_today - 15);
  perform public.add_purchase_payment(v_purchase, a_bank, round(141 * v_rate.bcv_usd, 2), 'bcv_usd', null, v_at);
  -- Día −14: segundo lote de filipinas negras y blancas.
  v_at := (v_today - 14)::timestamp at time zone 'America/Caracas' + interval '15 hours';
  for v_x in
    select v.id from public.product_variants v join public.colors c on c.id = v.color_id
    where v.product_id = p_filipina and c.code in ('NEG', 'BLA')
  loop
    perform public.register_production(v_x, 4, null, 'Lote 2', v_at);
  end loop;
  -- Bordado tercerizado de gorros: concepto a crédito, sin pagar todavía (queda por pagar, vencida).
  perform public.create_purchase(
    s_embroidery,
    jsonb_build_array(jsonb_build_object('line_type', 'concept', 'description', 'Bordado de logos (lote octubre)', 'quantity', 1, 'unit_cost_usd', 85, 'category_id', c_maquila)),
    '[]'::jsonb, v_today - 3, null, null, v_at
  );

  -- ---------------------------------------------------------------- ventas (~60)
  v_methods := array[m_mobile, m_mobile, m_mobile, m_cash, m_cash, m_zelle, m_usdt];
  for i in 1..62 loop
    d := 29 - floor((i - 1) * 29.0 / 62)::integer;
    v_at := (v_today - d)::timestamp at time zone 'America/Caracas' + make_interval(hours => 9 + (i % 9), mins => (i * 7) % 60);
    v_method := v_methods[1 + floor(random() * array_length(v_methods, 1))::integer];

    -- Producto: más filipinas; algunos encargos de gorros.
    v_pick := random();
    v_source := 'stock';
    if v_pick < 0.45 then
      select id into v_variant from public.product_variants where product_id = p_filipina order by random() limit 1;
    elsif v_pick < 0.70 then
      select id into v_variant from public.product_variants where product_id = p_apron order by random() limit 1;
    elsif v_pick < 0.88 then
      select id into v_variant from public.product_variants where product_id = p_pants order by random() limit 1;
    else
      select id into v_variant from public.product_variants where product_id = p_cap order by random() limit 1;
      v_source := 'made_to_order';
    end if;

    begin
      v_sale := public.create_sale(
        p_channel => (array['in_person', 'whatsapp', 'whatsapp', 'instagram'])[1 + floor(random() * 4)::integer]::public.sale_channel,
        p_price_method_id => v_method,
        p_delivery_method => case when random() < 0.25 then 'delivery' else 'pickup' end::public.delivery_method,
        p_items => jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'quantity', 1 + floor(random() * 3)::integer, 'source', v_source)),
        p_customer_id => case when random() < 0.65 then v_customers[1 + floor(random() * array_length(v_customers, 1))::integer] end,
        p_delivery_fee_usd => 0,
        p_discount_type => case when i % 8 = 0 then 'percent'::public.discount_type end,
        p_discount_value => case when i % 8 = 0 then 10 end,
        p_discount_reason => case when i % 8 = 0 then 'Cliente frecuente' end,
        p_delivered => v_source = 'stock',
        p_occurred_at => v_at
      );
    exception when others then
      -- Sin stock de esa variante ese día: se salta (como en la vida real).
      v_skipped := v_skipped + 1;
      continue;
    end;

    select total_usd into v_total from public.sales where id = v_sale;
    select pm.rate_kind, a.currency into v_kind, v_currency
    from public.payment_methods pm join public.accounts a on a.id = pm.account_id where pm.id = v_method;
    select * into v_rate from public.exchange_rate_for_date((v_at at time zone 'America/Caracas')::date);

    -- 80% paga completo; 12% abona la mitad; 8% queda por cobrar.
    v_pick := random();
    if v_pick < 0.92 then
      perform public.add_sale_payment(
        v_sale, v_method,
        round(
          (case when v_pick < 0.80 then v_total else v_total / 2 end)
          * case when v_kind = 'bcv_usd' then v_rate.bcv_usd when v_currency = 'USDT' then v_rate.usd_usdt else 1 end,
          2
        ),
        null, v_at
      );
      if v_pick >= 0.80 then
        v_partial := v_partial || v_sale;
      end if;
    end if;

    if v_source = 'made_to_order' then
      select id into v_item from public.sale_items where sale_id = v_sale;
      v_mto_items := v_mto_items || v_item;
    end if;
  end loop;

  -- Algunas ventas con abono terminan de pagarse días después (con la tasa de ese día).
  for i in 1..coalesce(array_length(v_partial, 1), 0) loop
    continue when i % 2 = 0;
    select occurred_at into v_at from public.sales where id = v_partial[i];
    v_at := least(v_at + interval '4 days', now() - interval '1 hour');
    select * into v_rate from public.exchange_rate_for_date((v_at at time zone 'America/Caracas')::date);
    select ss.balance_usd, pm.rate_kind, a.currency into v_total, v_kind, v_currency
    from public.sales_summary ss join public.sales s on s.id = ss.sale_id
    join public.payment_methods pm on pm.id = s.price_method_id join public.accounts a on a.id = pm.account_id
    where ss.sale_id = v_partial[i];
    if v_total > 0.01 then
      perform public.add_sale_payment(
        v_partial[i],
        (select price_method_id from public.sales where id = v_partial[i]),
        round(v_total * case when v_kind = 'bcv_usd' then v_rate.bcv_usd when v_currency = 'USDT' then v_rate.usd_usdt else 1 end, 2),
        null, v_at
      );
    end if;
  end loop;

  -- Encargos: la mayoría ya se produjeron (consume tela); los más recientes siguen en producción.
  for i in 1..coalesce(array_length(v_mto_items, 1), 0) loop
    begin
      -- Pausa mínima: el estado vigente es el evento más reciente (created_at = clock_timestamp()).
      perform public.set_sale_item_status(v_mto_items[i], 'sewing');
      perform pg_sleep(0.002);
      if i <= array_length(v_mto_items, 1) - 2 then
        perform public.set_sale_item_status(v_mto_items[i], 'ready');
        perform pg_sleep(0.002);
        perform public.set_sale_item_status(v_mto_items[i], 'delivered');
      end if;
    exception when others then
      null; -- p. ej. falta tela del color: el encargo queda como está
    end;
  end loop;

  -- Una venta anulada (error de registro).
  select id into v_sale from public.sales order by occurred_at limit 1 offset 20;
  perform public.void_sale(v_sale, 'Registrada dos veces por error');

  -- ---------------------------------------------------------------- gastos, sueldos y movimientos
  -- Alquiler (día −28) y servicios (día −10) en efectivo USD; publicidad semanal en Bs.
  insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, description) values
    (a_cash, 'expense', c_rent, -300, (v_today - 28)::timestamp at time zone 'America/Caracas' + interval '9 hours', 'Alquiler del taller'),
    (a_cash, 'expense', c_services, -45, (v_today - 10)::timestamp at time zone 'America/Caracas' + interval '9 hours', 'Internet y luz');
  for d in 0..3 loop
    insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, description)
    values (a_bank, 'expense', c_ads, -round((35 + d * 3) * (public.exchange_rate_for_date(v_today - 26 + d * 7)).bcv_usd, 2),
            (v_today - 26 + d * 7)::timestamp at time zone 'America/Caracas' + interval '12 hours', 'Publicidad Instagram');
  end loop;
  insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, description)
  values (a_bank, 'expense', c_tax, -round(60 * (public.exchange_rate_for_date(v_today - 5)).bcv_usd, 2), (v_today - 5)::timestamp at time zone 'America/Caracas' + interval '10 hours', 'Impuesto municipal');

  -- Sueldos: adelanto a María (día −10), quincenas (día −15 y hoy) y el sueldo del dueño (día −1).
  perform public.register_salary_payment(t_maria, a_cash, 150, '1–15', null, null, (v_today - 15)::timestamp at time zone 'America/Caracas' + interval '17 hours');
  perform public.register_salary_payment(t_jose, a_cash, 120, '1–15', null, null, (v_today - 15)::timestamp at time zone 'America/Caracas' + interval '17 hours');
  v_x := public.register_salary_advance(t_maria, a_cash, 40, 'Adelanto', (v_today - 10)::timestamp at time zone 'America/Caracas' + interval '17 hours');
  perform public.register_salary_payment(t_maria, a_cash, 110, '16–30', array[v_x], null, now() - interval '30 minutes');
  perform public.register_salary_payment(t_jose, a_bank,
    round(120 * (select bcv_usd from public.exchange_rate_for_date(v_today)), 2), '16–30', null, null, now() - interval '30 minutes');
  perform public.register_salary_payment(t_owner, a_binance, 400, 'Mes', null, null, (v_today - 1)::timestamp at time zone 'America/Caracas' + interval '18 hours');

  -- Retiro del dueño (día −20).
  insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, description, team_member_id)
  values (a_cash, 'expense', c_withdrawal, -100, (v_today - 20)::timestamp at time zone 'America/Caracas' + interval '19 hours', 'Retiro personal', t_owner);

  -- Reinversión (día −18): máquina bordadora, pagada con USDT.
  perform public.create_purchase(
    s_embroidery,
    jsonb_build_array(jsonb_build_object('line_type', 'concept', 'description', 'Máquina bordadora usada', 'quantity', 1, 'unit_cost_usd', 600, 'category_id', c_reinvest)),
    jsonb_build_array(jsonb_build_object('account_id', a_binance, 'amount', 600)),
    null, null, null, (v_today - 18)::timestamp at time zone 'America/Caracas' + interval '11 hours'
  );

  -- Cambio Bs → USDT (día −12, 1% de comisión) y aporte a la reserva (día −2).
  select * into v_rate from public.exchange_rate_for_date(v_today - 12);
  perform public.create_account_transfer(
    a_bank, a_binance, round(800 * v_rate.binance_usdt, 2), 792,
    (v_today - 12)::timestamp at time zone 'America/Caracas' + interval '14 hours', 'Cambio a USDT', null,
    v_rate.bcv_usd, v_rate.binance_usdt, v_rate.usd_usdt
  );
  perform public.create_account_transfer(
    a_binance, a_reserve, 150, 150, (v_today - 2)::timestamp at time zone 'America/Caracas' + interval '14 hours', 'Reserva del mes'
  );

  -- Política de la utilidad.
  update public.profit_policy set reserve_account_id = a_reserve, reserve_percent = 10, reinvestment_percent = 20;

  -- ---------------------------------------------------------------- fechas de registro
  -- Todo lo creado arriba lleva created_at = ahora; se iguala a la fecha del hecho para que el
  -- demo no aparezca entero como "retroactivo". Solo filas de esta transacción (created_at = now()).
  alter table public.sales disable trigger sales_guard_update;
  alter table public.sale_payments_all disable trigger sale_payments_immutable;
  alter table public.purchases disable trigger purchases_immutable;
  alter table public.purchase_payments disable trigger purchase_payments_immutable;
  alter table public.ledger_entries disable trigger ledger_entries_immutable;
  alter table public.stock_movements disable trigger stock_movements_immutable;
  alter table public.production_runs disable trigger production_runs_immutable;
  alter table public.payroll_entries disable trigger payroll_entries_immutable;

  update public.sales set created_at = occurred_at, is_backdated = false where created_at >= now();
  update public.sale_payments_all set created_at = occurred_at, is_backdated = false where created_at >= now();
  update public.purchases set created_at = occurred_at, is_backdated = false where created_at >= now();
  update public.purchase_payments set created_at = occurred_at, is_backdated = false where created_at >= now();
  update public.ledger_entries set created_at = occurred_at where created_at >= now();
  update public.stock_movements set created_at = occurred_at where created_at >= now();
  update public.production_runs set created_at = occurred_at, is_backdated = false where created_at >= now();
  update public.payroll_entries set created_at = occurred_at where created_at >= now();

  alter table public.sales enable trigger sales_guard_update;
  alter table public.sale_payments_all enable trigger sale_payments_immutable;
  alter table public.purchases enable trigger purchases_immutable;
  alter table public.purchase_payments enable trigger purchase_payments_immutable;
  alter table public.ledger_entries enable trigger ledger_entries_immutable;
  alter table public.stock_movements enable trigger stock_movements_immutable;
  alter table public.production_runs enable trigger production_runs_immutable;
  alter table public.payroll_entries enable trigger payroll_entries_immutable;

  raise notice 'Seed demo listo: % ventas, % compras (% ventas omitidas por falta de stock).',
    (select count(*) from public.sales), (select count(*) from public.purchases), v_skipped;
end;
$seed$;
