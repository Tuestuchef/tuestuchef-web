# Puesta en marcha

Pasos para conectar los servicios externos. Sin R2 la app funciona con los comprobantes deshabilitados. Supabase (con su clave secreta) y Resend son necesarios para iniciar sesión.

## 1. Cloudflare R2 (comprobantes y fotos)

### Buckets

1. Cloudflare → **R2 Object Storage**. Si es la primera vez, activa R2 (el plan gratuito cubre 10 GB).
2. **Create bucket** → nombre `tuestuchef-private` → ubicación *Automatic* → clase *Standard* → Create.
   - No actives el acceso público: los comprobantes solo se ven con URLs prefirmadas.
3. **Create bucket** → nombre `tuestuchef-public` → mismas opciones.

### Dominio público (solo `tuestuchef-public`)

1. `tuestuchef-public` → **Settings** → **Custom Domains** → **Connect Domain**.
2. Escribe un subdominio de tu dominio en Cloudflare, por ejemplo `media.tuestuchef.com` → Continue → Connect. Cloudflare crea el DNS y el certificado.
3. En el mismo lugar, deja **deshabilitado** el acceso por `r2.dev`.
4. Opcional (caché): Cloudflare → tu dominio → **Caching** → **Cache Rules** → regla para `media.tuestuchef.com` con *Eligible for cache* y *Edge TTL* de 1 mes.

### Token limitado a los dos buckets

1. R2 → **Manage API tokens** (en *Account details*) → **Create API token** (Account API token).
2. Nombre: `tuestuchef-app`.
3. Permisos: **Object Read & Write**.
4. Buckets: **Apply to specific buckets only** → `tuestuchef-public` y `tuestuchef-private`.
5. TTL: *Forever* (o una fecha, si prefieres rotarlo).
6. **Create API Token** y copia en ese momento (no se vuelven a mostrar):
   - *Access Key ID* → `R2_ACCESS_KEY_ID`
   - *Secret Access Key* → `R2_SECRET_ACCESS_KEY`

No uses el *Token value* (el de la API de Cloudflare): la app usa las credenciales S3.

### CORS

El navegador sube el archivo directo a R2 con un `PUT` prefirmado, así que cada bucket debe aceptar ese origen. `tuestuchef-private` → **Settings** → **CORS Policy** → **Add CORS policy** / Edit → pega (cambia el dominio por el del panel):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://admin.tuestuchef.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

En `tuestuchef-public` la misma política, agregando `"GET"` a `AllowedMethods` (para las fotos de productos).

Staging tiene sus propios buckets con su propio CORS (sección 6.2).

### Variables

| Variable | Valor |
| --- | --- |
| `R2_ACCOUNT_ID` | Account ID de Cloudflare (R2 → Overview, columna derecha; o en la URL `dash.cloudflare.com/<ACCOUNT_ID>/r2`) |
| `R2_ACCESS_KEY_ID` | *Access Key ID* del token |
| `R2_SECRET_ACCESS_KEY` | *Secret Access Key* del token |
| `R2_PUBLIC_BUCKET` | `tuestuchef-public` |
| `R2_PRIVATE_BUCKET` | `tuestuchef-private` |
| `R2_PUBLIC_URL` | `https://media.tuestuchef.com` (sin barra final) |

Local: en `.env.local` y reinicia `npm run dev`. Vercel: Project → Settings → Environment Variables, entorno **Production** (los valores de staging van en **Preview**, ver sección 6), luego redeploy.

Comprobación: en **Nuevo movimiento**, el campo *Comprobante* deja de mostrar el aviso y permite adjuntar. Adjunta una foto, guarda, y en **Movimientos** el clip abre el archivo.

## 2. Resend (correos de acceso)

Supabase Auth envía los códigos de acceso y las invitaciones. Su correo integrado solo llega a miembros de tu organización de Supabase, así que se usa Resend como SMTP.

1. resend.com → **Domains** → **Add Domain** → `tuestuchef.com` (o un subdominio, p. ej. `mail.tuestuchef.com`).
2. Agrega en Cloudflare DNS los registros que muestra Resend (SPF, DKIM y, si aparece, MX de rebote). En Cloudflare déjalos *DNS only* (nube gris). Espera a que Resend marque el dominio como **Verified**.
3. **API Keys** → **Create API Key** → nombre `supabase-auth` → permiso **Sending access** → dominio `tuestuchef.com`. Cópiala (se muestra una vez): es `RESEND_API_KEY`.
4. Elige el remitente, p. ej. `acceso@tuestuchef.com` (`AUTH_EMAIL_FROM`), y el nombre `Tuestuchef` (`AUTH_EMAIL_SENDER_NAME`).

## 3. Supabase (proyecto en la nube)

1. Crea el proyecto en supabase.com (región cercana, p. ej. `us-east-1`).
2. Enlaza y aplica las migraciones (no corras el seed en la nube: tiene usuarios de prueba):
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF> --workdir src/common/lib
   npm run db:push
   ```
3. **Project Settings → API Keys**: la *Publishable key* va en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; crea una *Secret key* para `SUPABASE_SECRET_KEY` (**obligatoria**: el login la usa). La URL del proyecto va en `NEXT_PUBLIC_SUPABASE_URL`.
4. **Authentication → Sign In / Providers → Email**:
   - Desactiva *Allow new users to sign up* (los usuarios se invitan).
   - *Email OTP Expiration*: `600` segundos. *Email OTP Length*: `6`.
5. **Authentication → Emails → SMTP Settings** → *Enable Custom SMTP*:

   | Campo | Valor |
   | --- | --- |
   | Sender email | `AUTH_EMAIL_FROM` (p. ej. `acceso@tuestuchef.com`) |
   | Sender name | `Tuestuchef` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | `RESEND_API_KEY` |
   | Minimum interval between emails | `60` segundos |

   Después, en **Authentication → Rate Limits**, sube *emails per hour* (p. ej. 100): con SMTP propio ya no aplica el límite de 2 por hora.
6. **Authentication → Emails → Templates**:
   - **Magic Link**: asunto `Tu código para entrar a Tuestuchef`; cuerpo = `src/common/lib/supabase/templates/magic-link.html`. **Imprescindible**: sin `{{ .Token }}` el correo no trae el código.
   - **Invite user**: asunto `Te invitaron al panel de Tuestuchef`; cuerpo = `templates/invite.html`.
7. **Authentication → Multi-Factor**: *TOTP (App Authenticator)* en **Enabled**. Es gratis en todos los planes.
8. **Authentication → Hooks** → *Customize Access Token (JWT) Claims* → tipo *Postgres* → función `public.custom_access_token_hook`. Así un usuario desactivado no obtiene sesión aunque tenga un código.
9. **Authentication → URL Configuration**: *Site URL* = `https://admin.tuestuchef.com`; en *Redirect URLs* agrega `https://admin.tuestuchef.com/auth/confirm` (y `http://localhost:3000/auth/confirm` para desarrollo).
10. Sesión de 30 días:
    - La cookie de sesión dura 30 días en el dispositivo (se renueva al usar el panel).
    - Tope absoluto: **Authentication → Sessions → Time-box user sessions** = `720` horas. Es una opción del plan Pro; en el plan gratuito la sesión se mantiene mientras el dispositivo la use al menos una vez cada 30 días.
11. Crea el primer owner y entra:
    ```bash
    npm run create-first-owner -- --email dueno@tuestuchef.com --name "Nombre Apellido"
    ```
    En `/login` escribe ese correo, pega el código y activa la app autenticadora.

### Si un owner o admin pierde el teléfono

Otro owner no puede quitarle el 2FA desde el panel (todavía). Se hace en Supabase → **Authentication → Users** → la persona → **Remove MFA factor**. Al volver a entrar, el panel le pide configurarlo de nuevo.

## 4. Tasas automáticas (Vercel Cron)

- `vercel.json` programa `/api/cron/exchange-rates` a las `0 10 * * *` UTC (6:00 en Caracas). En el plan Hobby puede correr en cualquier momento de esa hora.
- En Vercel agrega `CRON_SECRET` (y `SUPABASE_SECRET_KEY`, que ya usa el login). El cron solo corre en producción.
- Localmente no hay cron: usa **Tasas y cuentas → Actualizar desde BCV**.

## 4.1 Avisos (correo y push)

El resumen diario sale a las 7:00 (hora de Caracas) desde `/api/cron/notifications` (Vercel Cron, `vercel.json`, protegido con `CRON_SECRET`).

- **Correo**: usa `RESEND_API_KEY` (la misma de los correos de acceso). Remitente en `NOTIFICATIONS_EMAIL_FROM` (si falta, `AUTH_EMAIL_FROM`); su dominio debe estar verificado en Resend.
- **Push**: genera las claves una sola vez y guárdalas como variables:
  ```bash
  npx web-push generate-vapid-keys
  ```
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pública), `VAPID_PRIVATE_KEY` (secreta, solo servidor) y `VAPID_SUBJECT=mailto:correo@del-negocio`. Usa claves distintas en staging y en producción. En iPhone el push solo funciona con el panel instalado en la pantalla de inicio.
- Sin estas variables el canal queda apagado aunque esté prendido en Configuración → Avisos (la pantalla lo indica).
- Owner y admin prenden o apagan cada canal y cada aviso en **Configuración → Avisos**, con un botón para enviarse una prueba.

## 5. Pruebas

```bash
npm test        # todo
npm run db:test # migraciones, RLS e inmutabilidad en Postgres (PGlite), sin Docker
```

## 6. Staging

Staging es una copia completa del sistema, con sus propios servicios, para probar cada cambio antes de producción. Nunca comparte datos ni archivos con producción.

| Pieza | Producción | Staging |
| --- | --- | --- |
| URL | `https://admin.tuestuchef.com` | `https://staging.tuestuchef.com` |
| Rama de git | `main` | `staging` |
| Vercel | entorno *Production* | entorno *Preview* (rama `staging`) |
| Supabase | `Tuestuchef` (`qldqiemwxtaqkvmskxmr`) | `tuestuchef-demo` (`zfwohweuprtllcozbqdk`) |
| R2 | `tuestuchef-public`, `tuestuchef-private` | `tuestuchef-staging-public`, `tuestuchef-staging-private` |
| Fotos | `media.tuestuchef.com` | `media-staging.tuestuchef.com` |
| Token R2 | `tuestuchef-app` (solo buckets de producción) | `tuestuchef-staging` (solo buckets de staging) |
| Variables locales | `.env.local` | `.env.staging.local` |
| Correos | Resend, `acceso@tuestuchef.com` | Resend, mismo remitente; asunto con `[Staging]` |

### 6.1 Supabase (`tuestuchef-demo`)

1. Panel de demo → **Project Settings → Database → Reset database password**. Guárdala en tu gestor de contraseñas.
2. Enlaza demo y aplica todas las migraciones (te pide esa contraseña):
   ```bash
   npm run db:link:demo
   npm run db:linked   # debe decir DEMO (staging)
   npm run db:push
   ```
3. Repite la sección 3, pasos 3 a 10, en el proyecto demo, con estas diferencias:
   - *Site URL* = `https://staging.tuestuchef.com`; *Redirect URLs*: `https://staging.tuestuchef.com/auth/confirm` y `http://localhost:3000/auth/confirm`.
   - Plantillas de correo: el mismo HTML, con el asunto empezando por `[Staging] ` para distinguirlos.
   - Crea su propia *Secret key* (`tuestuchef-staging-server`). Nunca uses las claves de producción en staging ni al revés.
4. Crea el owner de staging (usa `.env.staging.local`, ver 6.4):
   ```bash
   npm run create-first-owner:demo -- --email tu-correo@... --name "Nombre Apellido"
   ```

### 6.2 Cloudflare R2

1. **Buckets**: igual que la sección 1, con los nombres `tuestuchef-staging-private` y `tuestuchef-staging-public`.
2. **Dominio público**: `tuestuchef-staging-public` → Settings → Custom Domains → `media-staging.tuestuchef.com`. Acceso por `r2.dev` deshabilitado.
3. **Token propio**: R2 → Manage API tokens → Create → nombre `tuestuchef-staging`, *Object Read & Write*, **solo** `tuestuchef-staging-public` y `tuestuchef-staging-private`. Así staging no puede tocar archivos de producción.
4. **CORS** en ambos buckets de staging (en el público agrega `"GET"`):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://staging.tuestuchef.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Los buckets de producción quedan solo con `https://admin.tuestuchef.com` (y `localhost` si desarrollas contra producción, cosa que no se recomienda).

### 6.3 Vercel

1. Crea la rama `staging` en git y súbela (`git push -u origin staging`).
2. **Settings → Domains** → agrega `staging.tuestuchef.com` → *Connect to an environment* → **Preview** → rama `staging`. En Cloudflare DNS, el CNAME `staging` → `cname.vercel-dns.com` con proxy **apagado** (nube gris), igual que `admin`.
3. **Settings → Environment Variables**: cada variable con su valor de staging en **Preview** (y el de producción solo en **Production**):

   | Variable | Preview (staging) |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://staging.tuestuchef.com` |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL de `tuestuchef-demo` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key de demo |
   | `SUPABASE_SECRET_KEY` | Secret key de demo |
   | `R2_ACCOUNT_ID` | el mismo Account ID |
   | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | las del token `tuestuchef-staging` |
   | `R2_PUBLIC_BUCKET` | `tuestuchef-staging-public` |
   | `R2_PRIVATE_BUCKET` | `tuestuchef-staging-private` |
   | `R2_PUBLIC_URL` | `https://media-staging.tuestuchef.com` |
   | `CRON_SECRET` | no hace falta (el cron solo corre en producción) |

   Cualquier preview de otra rama también usará staging: nunca puede tocar producción.
4. **Settings → Deployment Protection**: por defecto los previews piden iniciar sesión en Vercel. Para que el equipo entre a `staging.tuestuchef.com` sin cuenta de Vercel, desactiva la protección para ese dominio (el panel ya exige su propio login con código y 2FA).
5. Redeploy de la rama `staging`.

### 6.4 Local

`.env.local` apunta a **staging** (para desarrollar sin tocar datos reales). Copia los valores de Preview de la tabla 6.3 con `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Haz la misma copia en `.env.staging.local` (la usan los scripts de staging, como `create-first-owner:demo`).

### 6.5 Tasas en staging

El cron de Vercel solo corre en producción. En staging: **Tasas y cuentas → Actualizar desde BCV** cuando haga falta, o el seed demo (que carga un mes de tasas).

### 6.6 Flujo de un cambio

1. Se programa en una rama, con su migración en `src/common/lib/supabase/migrations/` y sus pruebas en `src/common/lib/db/tests/`.
2. `npm run db:test` en verde (PGlite, local).
3. Migraciones a **demo**:
   ```bash
   npm run db:link:demo
   npm run db:linked   # DEMO (staging)
   npm run db:push
   ```
4. Merge a `staging` → Vercel publica `staging.tuestuchef.com` → se prueba ahí.
5. Si todo está bien, migraciones a **producción** y merge a `main`:
   ```bash
   npm run db:link:prod
   npm run db:linked   # PRODUCCIÓN
   npm run db:push
   npm run db:link:demo   # volver a demo enseguida
   ```
   Primero la migración y después el merge: el código nuevo espera las tablas nuevas.

> **Migraciones solo con la CLI** (`npm run db:push`), nunca pegándolas en el SQL Editor ni con otras herramientas: así quedan registradas con la versión de su archivo. Por otro camino quedan con otra versión y el siguiente `db:push` intenta repetirlas.

> Antes de cualquier `db:push`, `npm run db:linked` dice a qué base va. El proyecto queda enlazado a demo por defecto; producción se enlaza solo para publicar y se desenlaza al terminar.

### 6.7 Datos de prueba (seed demo)

`src/common/lib/supabase/seed-demo.sql` carga un mes de operación realista para probar el dashboard: tasas diarias, cuentas y métodos, catálogo con materia prima y recetas, compras (contado, crédito, abonos y una por pagar vencida), producción, ~50 ventas (pagadas, con abonos, por cobrar, con descuento, encargos en producción y una anulada), gastos, sueldos con un adelanto, un retiro, una reinversión, un cambio Bs → USDT con comisión y el aporte a la reserva.

> **Nunca en producción.** No es una migración ni la usa `db:push`; se corre a mano y solo en `tuestuchef-demo`.

Protecciones del propio script:

- No hace nada sin la línea de confirmación (`app.demo_seed = 'tuestuchef-demo'`).
- No corre si la base ya tiene ventas o compras: no se mezcla con datos reales ni se duplica.
- Necesita el owner de staging (`npm run create-first-owner:demo`); todo queda a su nombre.
- Pasa por las mismas funciones que la app (ventas, compras, producción, nómina), con sus reglas y la tasa de cada fecha.
- Respeta las tasas que ya existan y arma el mes hacia atrás partiendo de la última.

Cómo correrlo:

1. En el panel de Supabase, abre el proyecto **tuestuchef-demo** (confirma el nombre arriba a la izquierda) → **SQL Editor** → New query.
2. Primera línea:
   ```sql
   select set_config('app.demo_seed', 'tuestuchef-demo', false);
   ```
3. Debajo, pega el contenido completo de `seed-demo.sql` y ejecuta.

Para volver a cargarlo hay que partir de una base demo sin ventas ni compras (por ejemplo, `supabase db reset --linked` con demo enlazado, después de comprobarlo con `npm run db:linked`, y volver a crear el owner).
