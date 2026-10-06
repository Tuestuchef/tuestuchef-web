@AGENTS.md

# Tuestuchef: sistema de administración

Tuestuchef es una empresa venezolana de indumentaria gastronómica (filipinas, delantales, pantalones, estuches, gorros). Hoy todo se maneja a mano o por WhatsApp. Este proyecto reemplaza eso con un panel administrativo y, más adelante, una tienda online.

**Prioridad #1:** ordenar el dinero del negocio y separarlo del personal (lo llamamos "el Pulpo"). La tienda online es secundaria.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- Supabase: Postgres, Auth y Row Level Security
- Cloudflare R2: archivos (fotos y comprobantes), con Cloudflare delante como DNS y CDN
- Resend + React Email: correos
- Vercel: hosting
- Zod para validar; tipos generados desde Supabase
- TanStack Query para datos del lado cliente
- Idioma de la interfaz: español. Código, tablas y variables: inglés.

## UI del admin

Basado en shadcn `sidebar-07` (sidebar que colapsa a iconos). Instalar con:

```
npx shadcn@latest add sidebar-07
```

Mobile-first: el equipo registra datos sobre todo desde el celular. El admin debe funcionar como PWA. Registrar una venta debe tomar menos de 20 segundos.

## Marca y tema

La marca ya está aplicada. Paleta: `#960d13` (rojo de marca), `#d73a2c` (rojo), `#f2f2f1`, `#a6a6a6` y `#0f0f0f`.

- **Sin colores fijos.** Prohibido usar colores directos (`bg-black`, `text-[#333]`, hex en componentes). Todo va por tokens semánticos de shadcn (`bg-background`, `text-foreground`, `bg-primary`, `border`, etc.), definidos como variables CSS en un solo archivo (`globals.css`).
- **Negro, blanco y grises.** La interfaz usa `#0f0f0f`, `#f2f2f1`, `#a6a6a6` y grises intermedios. El sidebar es negro en ambos modos (usa los tokens `--sidebar-*`, nunca `primary` ni `muted`). `#a6a6a6` no se usa como texto sobre fondo claro: no se lee.
- **El rojo es del dinero.** Verde (`text-positive`) y rojo (`text-negative`, el `#d73a2c`) solo marcan dinero que entra o sale, siempre con `SignedAmount` (signo y flecha). Se usan en movimientos, flujo de caja y cobros o pagos; totales, saldos y precios van en el color del texto. Errores y acciones destructivas son neutros, con icono y texto. El rojo de marca `#960d13` (`--brand`) va solo en el logo y los documentos.
- **Configuración de marca centralizada** en `src/common/lib/config/brand.config.ts`: nombre comercial, eslogan, íconos (favicon, PWA, imagen para redes) y nombres de las tipografías. Los datos de contacto para recibos y correos (correo, teléfono, WhatsApp, Instagram, dirección, RIF) viven en la base (`business_profile`) y owner/admin los editan en Configuración → Datos de la empresa.
- **Logo:** siempre con `<Logo>` (`src/common/components/logo/logo.tsx`); nadie importa los archivos de `src/common/assets/logo/` directamente.
  - Variantes: `full`, `icon`, `lettering` (un trazo en `currentColor`), `gradient` (ícono a color, imagen) y `gradient-full` (ícono a color + letras).
  - `color`: `auto` (sigue el tema), `black` y `white` (fijos, tokens `ink` y `paper`) o `current`. En `gradient-full` es el color de las letras.
  - `layout`: `stacked` (letras debajo) o `inline` (al lado). El tamaño lo da la altura (`className="h-8"`).
- **Assets de marca** en `src/common/assets/brand/` (favicon, íconos de la app, imagen para redes); salen del ícono a color.
- **Tipografía por variable** (`--font-sans`, `--font-heading`): Open Sauce Sans (OFL, servida desde `src/common/assets/fonts/`) para el texto y TeX Gyre Heros (clon libre de Helvetica, licencia GUST, en la misma carpeta) para los títulos. No se usan archivos de Helvetica: incrustarla requiere una licencia web de Monotype. El PDF usa la Helvetica estándar de PDF (no se incrusta) y los correos la piden por nombre.
- **Modo oscuro** con las mismas variables.
- **Estados sin depender del color.** Éxito, advertencia y error se distinguen con icono y texto, en grises.
- **Documentos y correos:** el PDF y los correos usan `document-theme.config.ts` (copia de los tokens claros, con prueba que lo verifica). Todo correo va dentro de `EmailLayout` (`src/common/components/email/`): encabezado negro con el logo (`public/email/header.png`), línea del rojo de marca, tarjeta blanca y botones negros, en Helvetica. Las plantillas de acceso de Supabase (`src/common/lib/supabase/templates/`) se generan desde `src/modules/auth/components/emails/` con `npm run email:auth`; no se editan a mano.
- **Gráficas** con `--chart-*` (grises), distinguibles por patrón o etiqueta; verde y rojo solo si son de dinero.

## Arquitectura: Screaming Architecture

- `src/app/`: solo archivos de ruta delgados, sin lógica.
- `src/modules/<modulo>/`: `lib/{types,constants,schemas,services,actions,hooks,utils,stores}`, `components/`, `screens/`.
- `src/common/`: `lib/{db,config,hooks,providers,utils,constants}` y `components/` (`ui/` es de shadcn, no se edita a mano).
- Supabase CLI (config, migraciones, seed) vive en `src/common/lib/supabase/`, no en la raíz. Usar siempre los scripts `npm run db:*` (pasan `--workdir src/common/lib`). Clientes de Supabase en `src/common/lib/db/`.
- Carpetas y archivos en kebab-case con sufijo tipado: `.hook.ts`, `.service.ts`, `.action.ts`, `.schema.ts`, `.types.ts`, `.util.ts`, `.store.ts`.
- Server Components por defecto; `"use client"` solo si hace falta.
- Las Server Actions validan con Zod y llaman a `lib/services/`; nunca contienen consultas directas.
- Query keys centralizadas en `src/common/lib/constants/` (nunca inline).

## Reglas del dominio (importantes)

1. **Valor real en USDT.** En Venezuela hay tres tasas: BCV dólar, BCV euro y Binance (USDT). Cada transacción guarda su moneda, monto, tasa BCV, tasa Binance y su `usdt_value`, calculado **al momento** y nunca recalculado después.
   `valor real = monto en Bs ÷ tasa Binance del día`
2. **Dinero.** Usar `numeric` en Postgres. Nunca floats.
3. **Negocio vs. personal.** Todo movimiento de dinero se marca como del negocio o personal. Todo retiro de dinero de una persona del equipo (incluido el dueño) se registra como sueldo o adelanto, nunca como "prestado".
4. **Utilidad real** = ingresos reales − costos − gastos operativos − comisiones de cambio − impuestos − sueldos (incluido el del dueño). La reserva de caja y la reinversión **salen de la utilidad**, no se restan antes.
   - Costo: lo necesario para producir y vender este mes (tela, botones, alquiler, publicidad habitual, reparaciones).
   - Reinversión: para crecer (máquina nueva, línea nueva, campaña extra, stock adelantado).
5. **Stock por movimientos.** El saldo se calcula desde `stock_movements` (venta, compra, ajuste). No editar saldos a mano.
6. **Un solo modelo de ventas.** Una venta online y una registrada a mano caen en las mismas tablas; solo cambia el campo `channel`.
7. **Cuentas por moneda:** Bs, USDT, USD efectivo y Zelle. Las conversiones entre ellas guardan su comisión como registro propio.
8. **Precio por método de pago:** cada producto puede tener precio distinto según el método. Los precios se guardan en USD; el monto en Bs de una venta es `precio USD × tasa BCV dólar del día` (por ley), y la venta guarda esa tasa. El valor real sigue usando la tasa Binance.
9. **Facturación:** al inicio se emite recibo o nota de entrega, no factura fiscal (los requisitos del SENIAT se validan con un contador).
10. **Cédula del cliente:** dato personal. Guardarlo solo si es necesario y protegido.

## Roles

Nadie recibe trato especial: todos son usuarios del mismo sistema y lo que cambia es el rol. No se construyen features, pantallas ni reglas atadas a una persona; todo se basa en roles y permisos.

- `owner`: ve todo.
- `admin`: gestión completa.
- `staff`: registra ventas, gastos y stock; sin acceso a sueldos ni retiros.

Los permisos se aplican con RLS en la base de datos, no solo en la interfaz.

Acceso sin contraseñas: correo + código (OTP de Supabase Auth) para todos. Owner y admin además con 2FA por app autenticadora (TOTP) obligatorio: sus rutas, acciones y políticas RLS exigen sesión `aal2`. Sesión de 30 días en el dispositivo. Un usuario desactivado no puede pedir ni usar códigos.

## Archivos (Cloudflare R2)

- Dos buckets: `tuestuchef-public` (fotos de productos, con dominio propio y caché) y `tuestuchef-private` (comprobantes, facturas y documentos).
- Subidas y descargas privadas con URL prefirmada de corta duración. La API verifica la sesión antes de firmar.
- Validar tipo (JPG, PNG, PDF), tamaño máximo y nombre generado por el sistema.
- En la base de datos guardar solo la ruta (`receipts/2026/09/orden-123.jpg`), nunca la URL completa.
- Token de R2 limitado a esos buckets, solo como variable de entorno del servidor.

## Fases

**Fase 1 (empezar aquí):** productos y stock, ventas, movimientos (ingresos y egresos por categoría), tasas y cuentas, clientes.
**Fase 2:** proveedores y deudas (por pagar y por cobrar), costo por producto y margen, equipo (roles, sueldos, adelantos), dashboard de utilidad real y flujo de caja.
**Fase 3:** pedidos y producción, tienda online pública (checkout de una pantalla, OTP por correo), extras.

## Tienda online (Fase 3, solo como referencia)

Catálogo pre-generado, imágenes optimizadas y checkout en una sola pantalla: email, nombre, apellido, cédula, teléfono, método de pago, delivery o retiro. Todo se notifica por correo. El cliente consulta sus compras con un OTP enviado a su correo. Pagos manuales al inicio (pago móvil, Zelle, USDT, efectivo) con comprobante y aprobación desde el admin.

## Reglas de trabajo

- Empezar por lo más simple que funcione; no construir la Fase 2 ni 3 antes de tiempo.
- Cada cambio de esquema va como migración de Supabase.
- Cada migración lleva pruebas en `src/common/lib/db/tests/` (RLS e inmutabilidad primero) y pasa `npm run db:test` antes de darla por buena.
- Antes de crear un módulo nuevo, proponer su estructura y esperar confirmación.
- Validar con Zod en el servidor todo dato que entre.
- Cada cambio en un módulo actualiza, en el mismo cambio, su ayuda (`help.constants.ts`) y su capítulo del manual (`src/modules/manual/lib/constants/chapters/`). Un manual desactualizado es peor que no tenerlo.
