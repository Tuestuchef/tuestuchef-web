-- Sueldos a tasa BCV: se acuerdan en dólares o en euros y se pagan en bolívares con la tasa BCV
-- (dólar o euro) del día del pago.
-- · rate_kind 'none': el monto está en su moneda (Bs, USD o USDT), como antes.
-- · rate_kind 'bcv_usd' / 'bcv_eur': el monto está en USD / EUR y la moneda de pago es Bs (VES).

alter table public.salary_agreements
  add column rate_kind public.payment_rate_kind not null default 'none';

alter table public.salary_agreements
  add constraint salary_agreements_rate_kind_currency check (rate_kind = 'none' or currency = 'VES');

comment on column public.salary_agreements.rate_kind is
  'none: monto en su moneda. bcv_usd / bcv_eur: monto en USD / EUR, pagado en Bs con la tasa BCV del día.';

grant insert (rate_kind) on public.salary_agreements to authenticated;

-- La vista se creó con a.*: se recrea para incluir la columna nueva.
create or replace view public.current_salary_agreements
with (security_invoker = true)
as
select distinct on (a.team_member_id) a.*
from public.salary_agreements a
where a.effective_from <= public.caracas_today()
order by a.team_member_id, a.effective_from desc, a.created_at desc;
