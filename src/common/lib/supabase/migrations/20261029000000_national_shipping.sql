-- Tercera forma de entrega: envío nacional (por encomienda). Como el delivery, puede llevar cobro aparte.
alter type public.delivery_method add value if not exists 'national_shipping';
