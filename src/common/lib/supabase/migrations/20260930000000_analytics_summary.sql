-- Analítica: totales del libro por mes (Caracas), categoría y persona, en USDT.
-- Security invoker: aplica el RLS del libro (owner/admin con aal2 ven todo; staff solo lo suyo).
-- Los traspasos no tienen categoría y no cuentan; sus comisiones sí (categoría exchange_fee).
-- Los reversos restan solos porque tienen el valor opuesto.

create function public.analytics_ledger_summary(p_from date, p_to date)
returns table (
  month text,
  category_type public.category_type,
  category_name text,
  person_name text,
  usdt_value numeric
)
language sql
stable
set search_path = ''
as $$
  select
    to_char(l.occurred_at at time zone 'America/Caracas', 'YYYY-MM') as month,
    c.type as category_type,
    c.name as category_name,
    p.full_name as person_name,
    sum(l.usdt_value) as usdt_value
  from public.ledger_entries l
  join public.movement_categories c on c.id = l.category_id
  left join public.profiles p on p.id = l.person_id
  where l.occurred_at >= (p_from::timestamp at time zone 'America/Caracas')
    and l.occurred_at < ((p_to + 1)::timestamp at time zone 'America/Caracas')
  group by 1, 2, 3, 4
  order by 1, 2, 3;
$$;

revoke execute on function public.analytics_ledger_summary(date, date) from public, anon;
grant execute on function public.analytics_ledger_summary(date, date) to authenticated;
