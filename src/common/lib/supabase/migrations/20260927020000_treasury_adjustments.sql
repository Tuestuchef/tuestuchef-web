-- Ajustes de tesorería:
-- - Staff usa categorías sales, other_income, cost y operating_expense.
--   Sigue sin acceso a salary, withdrawal, capital_contribution, profit_distribution,
--   tax, reinvestment y exchange_fee.
-- - Solo owner y admin revierten movimientos (el motivo ya era obligatorio).
-- - Staff ve los reversos de lo que registró.
-- - Uso de categorías por usuario, para ordenar el registro rápido.

create or replace function public.category_type_staff_allowed(p_type public.category_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_type in ('sales', 'other_income', 'cost', 'operating_expense');
$$;

drop policy "ledger_entries: staff registra ventas y gastos operativos" on public.ledger_entries;

create policy "ledger_entries: staff registra ingresos y gastos permitidos"
on public.ledger_entries for insert
to authenticated
with check (
  public.has_role(array['staff']::public.app_role[])
  and entry_type in ('income', 'expense')
  and transfer_id is null
  and person_id is null
  and reverses_entry_id is null
  and public.staff_can_use_category(category_id)
);

-- Staff ve lo que registró y también los reversos que owner o admin hagan de eso,
-- para que su historial muestre qué se anuló.
drop policy "ledger_entries: staff ve lo que registró" on public.ledger_entries;

create policy "ledger_entries: staff ve lo que registró y sus reversos"
on public.ledger_entries for select
to authenticated
using (
  public.has_role(array['staff']::public.app_role[])
  and (
    created_by = (select auth.uid())
    or public.is_own_ledger_entry(reverses_entry_id)
  )
);

-- Categorías que más usa el usuario actual en los últimos 90 días.
create function public.my_category_usage()
returns table (category_id uuid, uses bigint, last_used_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select l.category_id, count(*) as uses, max(l.created_at) as last_used_at
  from public.ledger_entries l
  where l.created_by = (select auth.uid())
    and l.category_id is not null
    and l.reverses_entry_id is null
    and l.entry_type in ('income', 'expense')
    and l.created_at > now() - interval '90 days'
  group by l.category_id
  order by uses desc, last_used_at desc;
$$;

revoke execute on function public.my_category_usage() from public, anon;
grant execute on function public.my_category_usage() to authenticated;
