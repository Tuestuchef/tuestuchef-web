// Postgres real en WASM (PGlite) con lo mínimo que aporta Supabase: roles de la API,
// auth.uid(), auth.users y los permisos por defecto. Corre todas las migraciones
// para probar reglas, RLS e inmutabilidad sin Docker.
import fs from "node:fs"
import path from "node:path"

import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

import type { AppRole } from "@/common/lib/constants/roles.constants"

const SUPABASE_DIR = path.resolve(process.cwd(), "src/common/lib/supabase")

const BOOTSTRAP_SQL = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_auth_admin nologin noinherit;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema public to anon, authenticated, service_role, supabase_auth_admin;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
  created_at timestamptz, updated_at timestamptz, confirmation_token text,
  recovery_token text, email_change text, email_change_token_new text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users on delete cascade,
  provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz
);

create schema extensions;
create extension pgcrypto with schema extensions;

-- Igual que Supabase: todo lo nuevo en public queda abierto a los roles de la API
-- (las migraciones deben cerrarlo).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export type TestDb = PGlite

// until: corre solo las migraciones anteriores a ese prefijo, para probar cómo una migración
// convierte datos que ya existían; después applyMigrations(db, { from }) corre el resto.
export async function createTestDb({ seed = false, until }: { seed?: boolean; until?: string } = {}): Promise<TestDb> {
  const db = await PGlite.create({ extensions: { pgcrypto } })
  await db.exec(BOOTSTRAP_SQL)
  await applyMigrations(db, { until })

  if (seed) {
    await db.exec(fs.readFileSync(path.join(SUPABASE_DIR, "seed.sql"), "utf8"))
  }

  return db
}

export async function applyMigrations(db: TestDb, { from, until }: { from?: string; until?: string } = {}) {
  const migrationsDir = path.join(SUPABASE_DIR, "migrations")
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql") && (!from || file >= from) && (!until || file < until))
    .sort()

  for (const file of files) {
    try {
      await db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"))
    } catch (error) {
      throw new Error(`La migración ${file} falló: ${(error as Error).message}`)
    }
  }
}

// Crea un usuario de Auth (el trigger crea su perfil) y le asigna rol como sistema.
export async function createUser(
  db: TestDb,
  user: { id: string; email: string; role: AppRole; name?: string }
) {
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [user.id, user.email, { full_name: user.name ?? user.role }]
  )
  if (user.role !== "staff") {
    await db.query("update public.profiles set role = $2 where id = $1", [
      user.id,
      user.role,
    ])
  }
}

type Row = Record<string, unknown>

export type Aal = "aal1" | "aal2"

async function runAs<T extends Row>(
  db: TestDb,
  role: "anon" | "authenticated" | "service_role",
  claims: Record<string, string> | null,
  sql: string,
  params?: unknown[]
) {
  const sub = claims?.sub ?? ""
  const json = claims ? JSON.stringify(claims).replace(/'/g, "''") : ""
  await db.exec(
    `select set_config('request.jwt.claim.sub', '${sub}', false),
            set_config('request.jwt.claims', '${json}', false);
     set role ${role};`
  )
  try {
    return await db.query<T>(sql, params)
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);"
    )
  }
}

// Consultas como un usuario autenticado (uid) o como anon (null), con RLS activo.
// aal por defecto "aal2": sesión con 2FA verificado. Usa "aal1" para una sesión
// que solo pasó el código por correo.
export function asUser(db: TestDb, uid: string | null, { aal = "aal2" }: { aal?: Aal } = {}) {
  return <T extends Row = Row>(sql: string, params?: unknown[]) =>
    uid
      ? runAs<T>(db, "authenticated", { sub: uid, role: "authenticated", aal }, sql, params)
      : runAs<T>(db, "anon", null, sql, params)
}

// Consultas con la clave secreta (service_role): lo que hace el servidor.
export function asServiceRole(db: TestDb) {
  return <T extends Row = Row>(sql: string, params?: unknown[]) =>
    runAs<T>(db, "service_role", { role: "service_role" }, sql, params)
}

export const TEST_USERS = {
  OWNER: "00000000-0000-4000-8000-000000000001",
  ADMIN: "00000000-0000-4000-8000-000000000002",
  STAFF: "00000000-0000-4000-8000-000000000003",
} as const
