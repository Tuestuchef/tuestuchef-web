-- Modo simple: el menú muestra solo lo de todos los días (vender, pedidos, clientes, stock…).
-- Cada quien lo elige para sí; vacío = según el rol (staff empieza en simple, owner y admin en completo).
-- No cambia permisos: solo qué se ve en el menú.

alter table public.profiles add column simple_mode boolean;

comment on column public.profiles.simple_mode is
  'Menú simple (true) o completo (false). Nulo: staff simple, owner y admin completo.';

-- Cada quien cambia el suyo (la política "cada quien edita su nombre" ya limita a su propio perfil).
grant update (simple_mode) on public.profiles to authenticated;
