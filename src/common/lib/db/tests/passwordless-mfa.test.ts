import { beforeAll, describe, expect, it } from "vitest"

import {
  asServiceRole,
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS
const INACTIVE = "00000000-0000-4000-8000-000000000009"

let db: TestDb
let accountId: string
let categoryId: string
let entryId: string

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  await createUser(db, { id: INACTIVE, email: "Inactivo@T.test", role: "staff" })
  await db.query(`update public.profiles set is_active = false where id = '${INACTIVE}'`)

  const owner = asUser(db, OWNER, { aal: "aal2" })
  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (150, 170, 100)")
  const account = await owner<{ id: string }>(
    "insert into public.accounts (name, currency, kind) values ('Caja USD', 'USD', 'cash') returning id"
  )
  accountId = account.rows[0].id
  const category = await owner<{ id: string }>(
    "select id from public.movement_categories where type = 'sales' and is_system"
  )
  categoryId = category.rows[0].id
  const entry = await owner<{ id: string }>(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount)
     values ('${accountId}', 'income', '${categoryId}', 10) returning id`
  )
  entryId = entry.rows[0].id
})

describe.each([
  ["owner", OWNER],
  ["admin", ADMIN],
])("%s sin aal2 (solo código por correo) es rechazado", (_, id) => {
  const withoutMfa = () => asUser(db, id, { aal: "aal1" })

  it("no tiene rol", async () => {
    const { rows } = await withoutMfa()<{ role: string | null; ok: boolean }>(
      "select public.current_app_role() role, public.has_role(array['owner','admin','staff']::public.app_role[]) ok"
    )
    expect(rows[0]).toEqual({ role: null, ok: false })
  })

  it("no lee cuentas, libro, saldos, traspasos ni otros usuarios", async () => {
    const run = withoutMfa()
    for (const table of ["accounts", "ledger_entries", "account_balances", "account_transfers", "role_changes"]) {
      const { rows } = await run(`select * from public.${table}`)
      expect(rows, table).toHaveLength(0)
    }
    const profiles = await run<{ id: string }>("select id from public.profiles")
    expect(profiles.rows.map((r) => r.id)).toEqual([id])
  })

  it("no registra, revierte, traspasa ni gestiona usuarios", async () => {
    const run = withoutMfa()
    await expect(
      run("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (1, 1, 1)")
    ).rejects.toThrow(/row-level security/)
    await expect(
      run(
        `insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ('${accountId}', 'income', '${categoryId}', 1)`
      )
    ).rejects.toThrow(/row-level security/)
    await expect(run(`select public.reverse_ledger_entry('${entryId}', 'sin 2FA')`)).rejects.toThrow(
      /row-level security|no existe/
    )
    await expect(
      run("insert into public.accounts (name, currency, kind) values ('X', 'VES', 'bank')")
    ).rejects.toThrow(/row-level security/)
    const { affectedRows } = await run(`update public.profiles set is_active = false where id = '${STAFF}'`)
    expect(affectedRows).toBe(0)
  })

  it("con aal2 sí puede", async () => {
    const run = asUser(db, id, { aal: "aal2" })
    const { rows } = await run<{ n: number }>("select count(*)::int n from public.accounts")
    expect(rows[0].n).toBe(1)
  })
})

describe("staff entra solo con código por correo (aal1)", () => {
  it("lee cuentas y registra un gasto", async () => {
    const staff = asUser(db, STAFF, { aal: "aal1" })
    const { rows } = await staff<{ n: number }>("select count(*)::int n from public.accounts")
    expect(rows[0].n).toBe(1)
    const sale = await staff<{ id: string }>(
      `insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ('${accountId}', 'income', '${categoryId}', 5) returning id`
    )
    expect(sale.rows).toHaveLength(1)
  })
})

describe("pedir código de acceso", () => {
  it("solo usuarios activos (sin importar mayúsculas)", async () => {
    const server = asServiceRole(db)
    const check = async (email: string) =>
      (await server<{ ok: boolean }>("select public.can_request_login_code($1) ok", [email])).rows[0].ok
    expect(await check("staff@t.test")).toBe(true)
    expect(await check("  OWNER@t.test ")).toBe(true)
    expect(await check("inactivo@t.test")).toBe(false)
    expect(await check("nadie@t.test")).toBe(false)
  })

  it("no se puede consultar desde la API pública (evita averiguar correos)", async () => {
    await expect(asUser(db, null)("select public.can_request_login_code('staff@t.test')")).rejects.toThrow(
      /permission denied/
    )
    await expect(
      asUser(db, STAFF)("select public.can_request_login_code('staff@t.test')")
    ).rejects.toThrow(/permission denied/)
  })
})

describe("usuario desactivado bloqueado", () => {
  it("no puede pedir código", async () => {
    const { rows } = await asServiceRole(db)<{ ok: boolean }>(
      "select public.can_request_login_code('inactivo@t.test') ok"
    )
    expect(rows[0].ok).toBe(false)
  })

  it("aunque tenga un código, Auth no le emite sesión (hook)", async () => {
    const { rows } = await db.query<{ result: { error?: { http_code: number } } }>(
      "select public.custom_access_token_hook($1::jsonb) result",
      [{ user_id: INACTIVE, claims: { sub: INACTIVE, aal: "aal1" } }]
    )
    expect(rows[0].result.error?.http_code).toBe(403)
  })

  it("y con una sesión previa, RLS le niega todo", async () => {
    const run = asUser(db, INACTIVE, { aal: "aal1" })
    const { rows } = await run("select * from public.accounts")
    expect(rows).toHaveLength(0)
    await expect(
      run(
        `insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ('${accountId}', 'income', '${categoryId}', 1)`
      )
    ).rejects.toThrow(/row-level security/)
  })
})
