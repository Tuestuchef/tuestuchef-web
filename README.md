# Tuestuchef · Panel administrativo

Sistema de administración de Tuestuchef (indumentaria gastronómica). Las reglas del proyecto están en [CLAUDE.md](CLAUDE.md).

## Requisitos

- Node 22+
- Docker (solo para levantar Supabase local; las pruebas de base corren sin Docker)

## Primeros pasos

```bash
npm install
cp .env.example .env.local
npm run db:start      # levanta Supabase local e imprime URL y publishable key
npm run db:reset      # aplica migraciones y carga el seed (usuarios de prueba)
npm run dev
```

Acceso sin contraseña: correo + código de 6 dígitos; owner y admin además con app autenticadora (2FA). Usuarios de prueba (solo local): `owner@`, `admin@` y `staff@tuestuchef.test`; los códigos llegan a Mailpit (http://127.0.0.1:54324).

Para conectar R2, Resend y Supabase en la nube: [docs/puesta-en-marcha.md](docs/puesta-en-marcha.md). Modelo de datos: [docs/modelo-de-datos.md](docs/modelo-de-datos.md).

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:start` / `db:stop` | Supabase local |
| `npm run db:reset` | Recrea la base local con migraciones + seed |
| `npm run db:migration <nombre>` | Nueva migración |
| `npm run db:push` | Aplica migraciones al proyecto enlazado |
| `npm run db:types` | Regenera `src/common/lib/db/database.types.ts` |
| `npm test` | Todas las pruebas (Vitest) |
| `npm run db:test` | Migraciones, RLS e inmutabilidad en Postgres real (PGlite), sin Docker |
| `npm run create-first-owner -- --email … --name …` | Crea el primer owner (se niega si ya existe uno) |

## Estructura

```
src/
├── app/                 rutas delgadas (sin lógica)
│   ├── (admin)/         panel protegido por sesión
│   ├── (auth)/login/
│   ├── auth/            confirmar invitación, 2FA (activar y verificar), cerrar sesión
│   └── api/receipts/    descarga de comprobantes (URL prefirmada)
├── modules/             auth (sesión y usuarios), treasury (tasas, cuentas, traspasos),
│                        money-movements (libro y categorías), home
├── common/
│   ├── assets/brand/    logos e íconos (placeholders con el nombre final)
│   ├── components/      admin-shell, brand-logo, status-*, ui/ (shadcn)
│   └── lib/
│       ├── config/      brand.config.ts, env.config.ts, fonts.config.ts
│       ├── constants/   rutas, roles, navegación, query keys
│       ├── db/          clientes de Supabase, tipos generados y pruebas de base (tests/)
│       ├── services/    sesión, almacenamiento (R2 / memoria) y comprobantes
│       └── supabase/    CLI de Supabase: config, migraciones, seed
└── proxy.ts             refresca sesión y redirige a /login
```

## Marca

Todo el color vive en `src/app/globals.css` (hoy en escala de grises) y la identidad en `src/common/lib/config/brand.config.ts`. Para aplicar la marca: reemplazar los archivos de `src/common/assets/brand/`, poner `logo.ready: true` y cambiar los tokens.
