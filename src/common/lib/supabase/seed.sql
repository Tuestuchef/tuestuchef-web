-- Datos SOLO para desarrollo local (`supabase db reset`). Nunca correr en producción.
-- Crea un usuario por rol para probar permisos. Sin contraseña: se entra con el código
-- que llega a Mailpit (http://127.0.0.1:54324). Owner y admin configuran 2FA al entrar.

do $$
declare
  seed_users constant jsonb := '[
    {"id": "00000000-0000-4000-8000-000000000001", "email": "owner@tuestuchef.test", "name": "Owner de prueba", "role": "owner"},
    {"id": "00000000-0000-4000-8000-000000000002", "email": "admin@tuestuchef.test", "name": "Admin de prueba", "role": "admin"},
    {"id": "00000000-0000-4000-8000-000000000003", "email": "staff@tuestuchef.test", "name": "Staff de prueba", "role": "staff"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(seed_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (u ->> 'id')::uuid,
      'authenticated',
      'authenticated',
      u ->> 'email',
      '',
      now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('full_name', u ->> 'name'),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(),
      (u ->> 'id')::uuid,
      (u ->> 'id'),
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email', 'email_verified', true),
      'email',
      now(), now(), now()
    );

    update public.profiles
    set role = (u ->> 'role')::public.app_role
    where id = (u ->> 'id')::uuid;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Treasury: catálogo de ejemplo y tasa de hoy (creado por el owner de prueba)
-- ------------------------------------------------------------

insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt, note, created_by)
values (public.caracas_today(), 150.00000000, 170.00000000, 220.00000000, 'Tasa de ejemplo', '00000000-0000-4000-8000-000000000001');

insert into public.accounts (id, name, currency, kind, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'Banco Bs', 'VES', 'bank', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Binance USDT', 'USDT', 'crypto_wallet', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003', 'Caja USD', 'USD', 'cash', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004', 'Zelle', 'USD', 'zelle', '00000000-0000-4000-8000-000000000001');

insert into public.movement_categories (name, type, created_by) values
  ('Otros ingresos', 'other_income', '00000000-0000-4000-8000-000000000001'),
  ('Aporte de capital', 'capital_contribution', '00000000-0000-4000-8000-000000000001'),
  ('Tela y materiales', 'cost', '00000000-0000-4000-8000-000000000001'),
  ('Alquiler', 'cost', '00000000-0000-4000-8000-000000000001'),
  ('Publicidad habitual', 'cost', '00000000-0000-4000-8000-000000000001'),
  ('Delivery y envíos', 'operating_expense', '00000000-0000-4000-8000-000000000001'),
  ('Papelería y empaques', 'operating_expense', '00000000-0000-4000-8000-000000000001'),
  ('Impuestos', 'tax', '00000000-0000-4000-8000-000000000001'),
  ('Sueldos', 'salary', '00000000-0000-4000-8000-000000000001'),
  ('Adelantos y gastos personales', 'withdrawal', '00000000-0000-4000-8000-000000000001'),
  ('Reinversión', 'reinvestment', '00000000-0000-4000-8000-000000000001'),
  ('Reparto de utilidades', 'profit_distribution', '00000000-0000-4000-8000-000000000001');

insert into public.payment_methods (name, account_id, price_currency, sort_order, created_by) values
  ('Pago móvil', '10000000-0000-4000-8000-000000000001', 'USD', 1, '00000000-0000-4000-8000-000000000001'),
  ('Zelle', '10000000-0000-4000-8000-000000000004', 'USD', 2, '00000000-0000-4000-8000-000000000001'),
  ('USDT', '10000000-0000-4000-8000-000000000002', 'USDT', 3, '00000000-0000-4000-8000-000000000001'),
  ('Efectivo USD', '10000000-0000-4000-8000-000000000003', 'USD', 4, '00000000-0000-4000-8000-000000000001');
