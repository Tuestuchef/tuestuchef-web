-- Presupuestos, paso 4: PDF congelado al enviar.
--
-- Al enviarse, el servidor genera el PDF una sola vez y lo guarda en el bucket privado; aquí se
-- anota su ruta. Solo una vez y solo de un presupuesto ya enviado: el PDF oficial no se reemplaza.

create or replace function public.set_quote_pdf_path(p_quote_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
begin
  if not public.has_role(array['owner', 'admin', 'staff']::public.app_role[]) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'El presupuesto no existe.';
  end if;
  if v_quote.status = 'draft' or v_quote.status = 'discarded' then
    raise exception 'El PDF oficial se guarda al enviar el presupuesto.';
  end if;
  if v_quote.pdf_path is not null then
    raise exception 'El presupuesto % ya tiene su PDF.', v_quote.code;
  end if;
  update public.quotes set pdf_path = p_path where id = p_quote_id;
end;
$$;

revoke all on function public.set_quote_pdf_path(uuid, text) from public, anon;
grant execute on function public.set_quote_pdf_path(uuid, text) to authenticated;
