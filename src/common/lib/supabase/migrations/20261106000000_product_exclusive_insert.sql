-- Arreglo: crear un producto fallaba con "No tienes permiso" desde los acuerdos con clientes.
-- 20261104 dio permiso de UPDATE sobre products.exclusive_customer_id pero no de INSERT,
-- y el formulario siempre manda ese campo (vacío si no es exclusivo) al crear.

grant insert (exclusive_customer_id) on public.products to authenticated;
