-- Presupuestos, paso 5 (tipos): el mensaje de presupuesto y el canal correo.
-- Va aparte porque un valor nuevo de un enum no se puede usar en la misma transacción.

alter type public.message_kind add value if not exists 'quote';
alter type public.message_channel add value if not exists 'email';
