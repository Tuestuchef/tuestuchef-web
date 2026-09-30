# Modelo de datos · Fase 1

Referencia del esquema de Tuestuchef. Cada tabla nueva o cambio de esquema va como migración en `src/common/lib/supabase/migrations/` y debe reflejarse aquí.

Orden de construcción: **auth → treasury + libro de movimientos → products → customers → sales**.

## Convenciones

| Tema | Regla |
| --- | --- |
| Claves | `id uuid` con `gen_random_uuid()` |
| Montos | `numeric(20,2)` |
| Tasas | `numeric(20,8)` (BCV publica 8 decimales) |
| Valor real | `usdt_value numeric(20,6)` |
| Cantidades de stock | `numeric(12,3)` (admite metros o kilos de materia prima en Fase 2) |
| Monedas | enum `currency`: `VES`, `USD`, `USDT`. El euro solo existe como tasa |
| Auditoría | Toda tabla guarda `created_by` y `created_at`. Los catálogos editables guardan además `updated_by` y `updated_at`. `created_by` lo fija la base con el usuario de la sesión; no se puede suplantar |
| Inmutables | Tasas, libro, traspasos, stock y ventas: sin permiso de edición ni borrado para nadie, más un trigger que rechaza cualquier `UPDATE` o `DELETE`. Los errores se corrigen con reversos o anulaciones |
| Catálogos | No se borran; se desactivan (`is_active`) |
| Zona horaria | "El día" es el de Caracas (`America/Caracas`) |
| Escrituras compuestas | Traspasos, reversos, ventas y anulaciones se escriben con funciones SQL en una sola transacción. Las server actions validan con Zod y llaman a esas funciones. Los permisos los aplica RLS |
| Reversos | Llevan la fecha (`occurred_at`) del original, así el período del error queda corregido; `created_at` dice cuándo se corrigió |
| Permisos por defecto | Supabase da acceso a `anon` y `authenticated` a todo lo nuevo. Cada migración revoca eso y concede solo lo necesario (tablas, columnas editables y funciones) |

### Valor real (`usdt_value`)

Lo calcula la base al insertar y nunca se recalcula. Cada movimiento guarda las tres tasas con las que se calculó:

| Moneda | Cálculo |
| --- | --- |
| `VES` | monto ÷ `binance_rate` |
| `USDT` | monto |
| `USD` (efectivo y Zelle) | monto × `usd_usdt_rate` (por defecto 1) |

Si no se indican tasas, se toman de la última tasa registrada. Si no hay ninguna, el movimiento se rechaza.

## 0. Auth

**`profiles`**: un perfil por usuario de Supabase Auth (se crea solo con un trigger).
- `full_name`, `email` (sincronizado desde Auth), `role` (`owner` | `admin` | `staff`), `is_active`, `invited_by` → `profiles`.
- Funciones `current_app_role()` y `has_role(roles[])`: base de todas las políticas RLS. Un usuario inactivo no tiene rol y por tanto no tiene acceso. **Owner y admin solo tienen rol con una sesión `aal2`** (2FA verificado); con `aal1` RLS les niega todo. Staff tiene rol con `aal1`.
- Cada quien edita su nombre. Rol y estado los gestionan owner y admin desde `/configuracion/usuarios`.

**`role_changes`** (inmutable): cada cambio de rol o estado. `profile_id`, `previous_role`, `new_role`, `previous_is_active`, `new_is_active`, `changed_by` (vacío = sistema), `changed_at`. Lo escribe un trigger; owner y admin lo leen.

### Acceso

- Sin contraseñas: se entra con el correo y un código de 6 dígitos (Supabase Auth, OTP por correo, vence en 10 minutos). `shouldCreateUser: false`: nadie se registra solo.
- Owner y admin, además, con app autenticadora (TOTP). Si no la tienen, el panel les pide activarla antes de entrar (`/auth/2fa/activar`); si la tienen, piden el código (`/auth/2fa`).
- `can_request_login_code(email)`: solo el servidor (clave secreta) la ejecuta; un correo inexistente o desactivado no recibe código y la respuesta en pantalla es la misma (no revela quién tiene acceso).
- Sesión de 30 días en el dispositivo (cookie; tope absoluto con `auth.sessions.timebox`).

Reglas (RLS + triggers; el servidor las valida también):

| Regla | Cómo se aplica |
| --- | --- |
| Solo owner asigna o quita los roles owner y admin | Política de UPDATE de owner; la de admin exige `role = staff` antes y después |
| Admin solo gestiona staff | Política `profiles: admin gestiona staff` |
| Siempre al menos un owner activo | Trigger `profiles_guard_changes` (bloquea a los owners para evitar carreras) |
| Nadie cambia su propio rol ni se desactiva | Trigger `profiles_guard_changes` |
| Los usuarios no se borran | Trigger `profiles_no_delete` (también bloquea borrar el usuario de Auth) |
| Un desactivado no pide ni usa códigos | `can_request_login_code` (no se envía) + hook `custom_access_token_hook` (no emite token) + `has_role` + chequeo al verificar |
| Owner y admin con 2FA | `current_app_role()` exige `aal2`; el servidor los manda a activar o confirmar 2FA |
| El primer owner se crea por script | `npm run create-first-owner` (se niega si ya hay un owner activo) |

Invitaciones: Supabase Auth `inviteUserByEmail` con la clave secreta, solo desde el servidor y después de validar el rol de quien invita. El perfil nace como `staff`; si el rol pedido es otro, se asigna con la sesión de quien invita (RLS lo vuelve a validar y queda en `role_changes`).

## 1. Treasury + libro de movimientos

### `exchange_rates` (inmutable)

| Campo | Notas |
| --- | --- |
| `rate_date` | Día al que aplica (Caracas) |
| `bcv_usd`, `bcv_eur`, `binance_usdt` | Bs por unidad |
| `usd_usdt` | USDT por 1 USD. Default 1 |
| `note` | Opcional |

- `source`: `api` (automática, sin autor) o `manual` (con autor). Los usuarios solo registran manuales.
- **Automática:** cada día a las 6:00 (Caracas) Vercel Cron llama a `/api/cron/exchange-rates` (protegida con `CRON_SECRET`), que lee DolarAPI: BCV oficial USD y EUR, y **paralelo como tasa USDT** (columna `binance_usdt`). `rate_date` = fecha valor del BCV. Owner y admin también pueden pedirla con "Actualizar desde BCV".
- Una tasa manual registrada hoy no se reemplaza por la automática. Una automática igual a la última no se duplica si esa ya se guardó hoy; si es de otro día se guarda igual, para que cada día tenga su registro (el BCV no publica fines de semana ni feriados).
- "Tasa de hoy" = la vigente tiene fecha BCV de hoy **o** se guardó hoy.
- La tasa vigente es la fila más reciente (`rate_date`, luego `created_at`). Corregir = agregar otra fila para el mismo día.
- Staff puede registrar la tasa de hoy **solo si aún no existe**. Registrar otros días y corregir es de owner y admin.

### `accounts`

| Campo | Notas |
| --- | --- |
| `name` | Único |
| `currency` | No se puede cambiar después de creada |
| `kind` | `bank` (VES o USD), `cash` (VES o USD), `zelle` (USD), `crypto_wallet` (USDT) |
| `is_active`, `notes` | |

Sin columna de saldo: el saldo sale de la vista `account_balances`.

### `movement_categories`

| Campo | Notas |
| --- | --- |
| `name` | Único |
| `type` | Ver tabla de tipos. No se puede cambiar después de creada |
| `scope` | Calculado desde el tipo: `business` o `personal` |
| `is_system` | Categorías que usa el sistema ("Ventas", "Comisión de cambio"). No se editan ni desactivan |
| `is_active` | |

Tipos (`category_type`):

| Tipo | Signo | Ámbito | Persona | Staff | En la utilidad real |
| --- | --- | --- | --- | --- | --- |
| `sales` | entra | business | no | sí | ingreso |
| `other_income` | entra | business | no | sí | ingreso |
| `capital_contribution` | entra | personal | obligatoria | no | no cuenta (aporte, no ingreso) |
| `cost` | sale | business | no | sí | se resta |
| `operating_expense` | sale | business | no | sí | se resta |
| `exchange_fee` | ambos | business | no | no | se resta (o suma si hubo ganancia cambiaria) |
| `tax` | sale | business | no | no | se resta |
| `salary` | sale | business | obligatoria | no | se resta |
| `withdrawal` | sale | personal | obligatoria | no | se resta (adelanto de sueldo) |
| `reinvestment` | sale | business | no | no | sale **de** la utilidad |
| `profit_distribution` | sale | personal | obligatoria | no | sale **de** la utilidad |

- Un gasto personal pagado desde una cuenta del negocio se registra como `withdrawal` de esa persona, nunca como gasto del negocio. Por eso el ámbito no se elige: solo `withdrawal`, `capital_contribution` y `profit_distribution` son personales.
- Staff solo ve y usa categorías `sales`, `other_income`, `cost` y `operating_expense` (aplicado en RLS).

### `ledger_entries` (inmutable): el libro

Una fila por cada cambio de saldo de una cuenta.

| Campo | Notas |
| --- | --- |
| `account_id` | Cuenta cuyo saldo cambia |
| `entry_type` | `income`, `expense`, `sale_payment`, `transfer_out`, `transfer_in`, `exchange_fee` |
| `category_id` | Obligatoria salvo en `transfer_out` y `transfer_in` |
| `amount` | Con signo: + entra, − sale. Nunca 0 |
| `currency` | La de la cuenta (la fija la base) |
| `bcv_usd_rate`, `binance_rate`, `usd_usdt_rate` | Fijadas al registrar |
| `usdt_value` | Con signo. Calculado por la base |
| `occurred_at` | Fecha real del movimiento |
| `description` | Texto libre. Obligatorio en reversos (motivo) |
| `person_id` → `profiles` | Obligatoria si la categoría es `salary`, `withdrawal`, `capital_contribution` o `profit_distribution`; vacía en las demás |
| `transfer_id` → `account_transfers` | Filas generadas por un traspaso |
| `reverses_entry_id` → `ledger_entries` | Reverso. Único: un movimiento se revierte una sola vez. El reverso copia cuenta, categoría, persona y tasas del original y lleva el monto opuesto, así lo anula exacto. Un reverso no se revierte |
| `receipt_path` | Ruta del comprobante en `tuestuchef-private` |

Qué categoría acepta cada tipo de movimiento:

| `entry_type` | Categorías |
| --- | --- |
| `income` | `sales`, `other_income`, `capital_contribution` |
| `expense` | `cost`, `operating_expense`, `exchange_fee`, `tax`, `salary`, `withdrawal`, `reinvestment`, `profit_distribution` |
| `sale_payment` | `sales` (lo genera el módulo de ventas) |
| `exchange_fee` | `exchange_fee` (lo genera un traspaso) |
| `transfer_out`, `transfer_in` | ninguna |

Un `income` con categoría "Ventas" sirve para registrar dinero de ventas sin detalle mientras no existe el módulo de ventas. Cuando exista, las ventas generan `sale_payment`.

### `account_transfers` (inmutable): traspasos y conversiones

| Campo | Notas |
| --- | --- |
| `from_account_id`, `to_account_id` | Distintas |
| `amount_out` | Lo que sale, en la moneda de origen |
| `amount_in` | Lo que llega, en la moneda de destino |
| `bcv_usd_rate`, `binance_rate`, `usd_usdt_rate` | Fijadas al registrar |
| `occurred_at`, `note`, `receipt_path` | |

Se registra con la función `create_account_transfer`, que escribe en el libro sin contar doble. Ejemplo: 10.000 Bs → 98 USDT con Binance a 100:

| Cuenta | Tipo | Monto | Valor real |
| --- | --- | --- | --- |
| Bs | `transfer_out` | −9.800 | −98 |
| Bs | `exchange_fee` ("Comisión de cambio") | −200 | −2 |
| USDT | `transfer_in` | +98 | +98 |

Los saldos cuadran (−10.000 Bs, +98 USDT), el traspaso neto vale 0 y la comisión queda como registro propio. Si hubo ganancia cambiaria, la fila de comisión sale positiva. Un traspaso se anula completo con `reverse_account_transfer`; sus filas no se revierten sueltas.

### `payment_methods`

| Campo | Notas |
| --- | --- |
| `name` | Único (pago móvil, Zelle, USDT, efectivo USD…) |
| `account_id` | Cuenta donde cae el dinero |
| `price_currency` | Moneda en que se expresan los precios de ese método (p. ej. pago móvil: precios en USD, se cobra en Bs a tasa BCV) |
| `sort_order`, `is_active` | |

### Vistas

- `current_exchange_rate`: la tasa vigente.
- `account_balances`: saldo por cuenta = suma del libro. Solo owner y admin.

### Funciones

- `create_account_transfer`, `reverse_account_transfer`: traspasos (owner y admin).
- `reverse_ledger_entry(id, motivo)`: reverso (owner y admin).
- `my_category_usage()`: categorías más usadas por la persona en 90 días (ordena el registro rápido).

### Comprobantes (Cloudflare R2)

- Bucket privado `tuestuchef-private`, ruta `receipts/AAAA/MM/<uuid>.<jpg|png|pdf>` generada por el sistema; la base guarda solo la ruta.
- Subida: el servidor verifica la sesión, valida tipo (JPG, PNG, PDF) y tamaño (máx. 10 MB) y firma un PUT de 5 minutos con el `Content-Type` firmado. Antes de guardar el movimiento, el servidor consulta el archivo en R2 (existe, tamaño y tipo); si no cuadra, lo borra.
- Descarga: `/api/receipts/<id del movimiento>` verifica la sesión, lee el movimiento con RLS (si no lo puedes ver, no hay comprobante) y redirige a un GET prefirmado de 5 minutos.
- Sin variables de R2 la app funciona: el campo se muestra deshabilitado con un aviso.

## 2. Products

- **`product_categories`**: `name` (filipinas, delantales, pantalones, estuches, gorros), `is_active`.
- **`products`**: `product_category_id`, `name`, `description`, `kind` (`finished_good` | `raw_material`; en Fase 1 solo `finished_good`), `fulfillment_type` (`stock` | `made_to_order` | `both`), `unit` (`unit` | `meter` | `kg`), `is_active`.
- **`product_variants`**: `product_id`, `sku` (único), `size`, `color`, `unit_cost_usdt`, `is_active`.
- **`product_prices`**: `product_id`, `variant_id` (opcional), `payment_method_id`, `amount` (en `price_currency` del método). Único por (producto, variante, método).
  - Precio de una variante = su precio propio para ese método si existe; si no, el del producto.
- **`stock_movements`** (inmutable): `variant_id`, `movement_type` (`purchase`, `production`, `sale`, `sale_reversal`, `adjustment`), `quantity` con signo, `unit_cost_usdt` (obligatorio en `purchase` y `production`), `sale_item_id`, `reverses_movement_id`, `note` (obligatoria en `adjustment`).
- **Vista `stock_balances`**: existencia por variante = suma de movimientos.
- Stock negativo bloqueado: quien vende sin stock registrado marca la línea por encargo o hace un ajuste primero. La carga inicial es un ajuste.
- Compra de materia prima: egreso en el libro con categoría `cost`. No toca stock en Fase 1.
- Compra de producto terminado: movimiento `purchase` con su costo, más el egreso en el libro.

## 3. Customers

- **`customers`**: `first_name`, `last_name`, `email`, `phone`, `instagram`, `notes`.
- **`customer_private`** (1:1): `customer_id`, `id_document` (cédula). Cualquier rol la registra; solo owner y admin la leen.

## 4. Sales (inmutable)

- **`sales`**: `number` (correlativo de la nota de entrega), `customer_id` (opcional), `channel` (`in_person`, `whatsapp`, `instagram`, `online_store`), `payment_method_id` (lista de precios usada), `currency` (la de esa lista), `bcv_usd_rate`, `binance_rate`, `usd_usdt_rate`, `delivery_method` (`pickup` | `delivery`), `occurred_at`, `notes`.
- **`sale_items`**: `sale_id`, `variant_id`, `quantity`, `unit_price` (moneda de la venta), `unit_cost_usdt` (copia del costo de la variante al vender), `source` (`stock` | `made_to_order`, validado contra el `fulfillment_type` del producto).
  - `stock` genera su `stock_movements`. `made_to_order` no toca stock y arranca en `to_produce`.
- **`sale_payments`**: `sale_id`, `ledger_entry_id` (único), `payment_method_id`, `applied_amount` (en moneda de la venta). El dinero vive solo en el libro; esta tabla dice a qué venta se aplica. Admite pagos parciales y mixtos.
- **`sale_item_status_events`**: `sale_item_id`, `status` (`to_produce`, `in_production`, `ready`, `delivered`). El estado actual es el último evento.
- **`sale_voids`** (1:1): `sale_id`, `reason`. Anular revierte el stock y los pagos en el libro.
- **Vista `sales_summary`**: total, pagado, saldo y `payment_status` (`pending` | `partial` | `paid` | `voided`), calculados para que la venta siga inmutable.

## Relaciones

```
profiles ──< created_by / updated_by (todas las tablas)
profiles ──< ledger_entries.person_id

accounts ──< ledger_entries >── movement_categories
               ├── transfer_id ──> account_transfers
               ├── reverses_entry_id ──> ledger_entries
               └──< sale_payments >── sales
accounts ──< payment_methods ──< product_prices >── products / product_variants

product_categories ──< products ──< product_variants ──< stock_movements
customers ── customer_private (1:1)
customers ──< sales ──< sale_items >── product_variants
sale_items ──< stock_movements          (solo líneas de inventario)
sale_items ──< sale_item_status_events  (solo líneas por encargo)
sales ── sale_voids (1:1)
```

## Utilidad real

Todo sale del libro (dinero efectivamente movido):

```
utilidad real = sales + other_income
              − cost − operating_expense − exchange_fee − tax − salary − withdrawal

sale de la utilidad: reinvestment, profit_distribution, reserva de caja
no cuenta:           capital_contribution, traspasos
```

`unit_cost_usdt` de ventas y variantes sirve para márgenes por producto; no se resta otra vez en la utilidad (ya se restaron los egresos `cost`).

## Permisos (RLS)

| | owner / admin | staff |
| --- | --- | --- |
| Cuentas, métodos de pago | leer y editar | leer |
| Categorías de movimiento | leer y editar | leer solo `sales`, `other_income`, `cost` y `operating_expense` |
| Tasas | leer, registrar y corregir | leer; registrar la de hoy si no existe |
| Libro | todo, incluido revertir (con motivo) | registra ingresos y gastos con sus categorías; ve lo que registró y los reversos de eso; no revierte |
| Usuarios | owner: todos los roles; admin: solo staff | no |
| Saldos y traspasos | sí | no |
| Productos, precios | leer y editar | leer |
| Stock | todo | registra y ve |
| Clientes | todo | todo, salvo leer la cédula |
| Ventas | todo, incluido anular | registrar, cobrar, avanzar estados |

## Decisiones

| Fecha | Decisión |
| --- | --- |
| 2026-09-27 | Tabla de categorías de dinero: `movement_categories` |
| 2026-09-27 | Tipos `other_income` y `capital_contribution` (con persona); `profit_distribution` sale de la utilidad como la reinversión |
| 2026-09-27 | Tipo `sales` para que los ingresos por ventas también lleven categoría |
| 2026-09-27 | USD y Zelle valen 1:1 con USDT por defecto; cada movimiento guarda `usd_usdt_rate` |
| 2026-09-27 | Precio por producto con precio opcional por variante que lo sobrescribe |
| 2026-09-27 | Stock negativo bloqueado |
| 2026-09-27 | Staff registra la tasa de hoy solo si no existe; corregir es de owner y admin |
| 2026-09-27 | Gasto personal desde cuenta del negocio = `withdrawal` de esa persona |
| 2026-09-27 | Staff usa categorías `sales`, `other_income`, `cost` y `operating_expense` (actualizado el mismo día) |
| 2026-09-27 | Solo owner y admin revierten movimientos, con motivo obligatorio |
| 2026-09-27 | Roles fijos sin permisos granulares; usuarios se desactivan, nunca se borran; bitácora `role_changes` |
| 2026-09-30 | Analítica (`/analitica`, owner y admin): utilidad real, ingresos vs egresos 12 meses, salidas por categoría y flujos por persona, desde `analytics_ledger_summary` (RLS). Verde/rojo con tokens `--positive`/`--negative`, siempre con signo y flecha |
| 2026-09-29 | Tasas automáticas desde DolarAPI cada mañana (BCV USD/EUR y paralelo como USDT); la manual prevalece |
| 2026-09-27 | Acceso sin contraseña (código por correo) para todos; owner y admin con 2FA TOTP obligatorio (aal2 en RLS); sesión de 30 días |
