-- Tasas automáticas desde DolarAPI (BCV oficial USD/EUR y paralelo como USDT).
-- - source: 'api' (las guarda el servidor, sin autor) o 'manual' (una persona).
-- - Una tasa manual siempre tiene autor; una de la API no.
-- - Los usuarios solo pueden registrar tasas manuales: no pueden escribir source.

create type public.rate_source as enum ('api', 'manual');

alter table public.exchange_rates
  add column source public.rate_source not null default 'manual';

alter table public.exchange_rates
  alter column created_by drop not null;

alter table public.exchange_rates
  add constraint exchange_rates_manual_has_author
  check (source = 'api' or created_by is not null);

comment on column public.exchange_rates.source is
  'api = guardada automáticamente desde DolarAPI; manual = registrada o corregida por una persona.';

revoke insert on public.exchange_rates from authenticated;
grant insert (rate_date, bcv_usd, bcv_eur, binance_usdt, usd_usdt, note) on public.exchange_rates to authenticated;

-- La vista se creó con select *: se recrea para incluir la nueva columna.
create or replace view public.current_exchange_rate
with (security_invoker = true)
as
select *
from public.exchange_rates
where rate_date <= public.caracas_today()
order by rate_date desc, created_at desc
limit 1;
