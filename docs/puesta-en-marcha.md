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

Si usas previews de Vercel con su propio dominio, agrégalo también a `AllowedOrigins`.

### Variables

| Variable | Valor |
| --- | --- |
| `R2_ACCOUNT_ID` | Account ID de Cloudflare (R2 → Overview, columna derecha; o en la URL `dash.cloudflare.com/<ACCOUNT_ID>/r2`) |
| `R2_ACCESS_KEY_ID` | *Access Key ID* del token |
| `R2_SECRET_ACCESS_KEY` | *Secret Access Key* del token |
| `R2_PUBLIC_BUCKET` | `tuestuchef-public` |
| `R2_PRIVATE_BUCKET` | `tuestuchef-private` |
| `R2_PUBLIC_URL` | `https://media.tuestuchef.com` (sin barra final) |

Local: en `.env.local` y reinicia `npm run dev`. Vercel: Project → Settings → Environment Variables (Production y Preview), luego redeploy.

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

## 5. Pruebas

```bash
npm test        # todo
npm run db:test # migraciones, RLS e inmutabilidad en Postgres (PGlite), sin Docker
```
