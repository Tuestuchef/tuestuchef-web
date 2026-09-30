import { beforeAll, describe, expect, it } from "vitest"

import {
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
type Row = { month: string; category_type: string; category_name: string; person_name: string | null; usdt_value: string }

const summary = (as: ReturnType<typeof asUser>) =>
  as<Row>("select * from public.analytics_ledger_summary('2026-01-01', '2026-12-31')")

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner", name: "Dueña" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  const owner = asUser(db, OWNER)
  // Movimientos con fecha pasada usan las tasas de su fecha: una fila por fecha usada (mismos valores).
  await owner(
    `insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt)
     select d::date, 150, 170, 100
     from unnest(array['2026-01-01', '2026-08-10', '2026-08-11', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-06']) d`
  )
  // Fechas fijas: se amplía el límite de retroceso de staff para no depender del día en que corre la prueba.
  await db.query("update public.sales_settings set staff_max_backdate_days = 365")
  const acc = await owner<{ id: string }>(
    "insert into public.accounts (name, currency, kind) values ('Binance', 'USDT', 'crypto_wallet'), ('Banco', 'VES', 'bank') returning id"
  )
  const [usdt, ves] = acc.rows.map((r) => r.id)
  const cats = await owner<{ id: string; name: string }>(
    `insert into public.movement_categories (name, type) values ('Tela', 'cost'), ('Retiros', 'withdrawal') returning id, name`
  )
  const id = Object.fromEntries(cats.rows.map((r) => [r.name, r.id]))
  const sales = (await owner<{ id: string }>("select id from public.movement_categories where type = 'sales'")).rows[0].id

  const insert = (account: string, type: string, category: string, amount: number, date: string, person = "null") =>
    owner(
      `insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at, person_id)
       values ('${account}', '${type}', '${category}', ${amount}, '${date}T12:00:00-04:00', ${person === "null" ? "null" : `'${person}'`}) returning id`
    )

  await insert(usdt, "income", sales, 500, "2026-08-10")
  await insert(usdt, "expense", id.Tela, -120, "2026-08-11")
  await insert(ves, "expense", id.Tela, -3000, "2026-09-02") // 30 USDT
  await insert(usdt, "expense", id.Retiros, -50, "2026-09-03", OWNER)
  const wrong = await insert(usdt, "income", sales, 999, "2026-09-04")
  await owner(`select public.reverse_ledger_entry('${(wrong.rows[0] as { id: string }).id}', 'error')`)
  await owner(`select public.create_account_transfer('${usdt}', '${ves}', 10, 1000, '2026-09-05T12:00:00-04:00')`)
  // Staff registra una venta propia.
  await asUser(db, STAFF, { aal: "aal1" })(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at) values ('${usdt}', 'income', '${sales}', 40, '2026-09-06T12:00:00-04:00')`
  )
})

describe("resumen para analítica", () => {
  it("agrupa por mes de Caracas y categoría, en USDT; reversos restan; traspasos no cuentan", async () => {
    const { rows } = await summary(asUser(db, OWNER))
    const get = (month: string, type: string) =>
      rows.filter((r) => r.month === month && r.category_type === type).reduce((s, r) => s + Number(r.usdt_value), 0)
    expect(get("2026-08", "sales")).toBe(500)
    expect(get("2026-08", "cost")).toBe(-120)
    expect(get("2026-09", "cost")).toBe(-30)
    expect(get("2026-09", "sales")).toBe(40) // 999 − 999 + 40 de staff
    expect(rows.some((r) => r.category_type === "exchange_fee")).toBe(false) // 10 USDT → 1000 Bs sin comisión
  })

  it("trae la persona de retiros (el Pulpo)", async () => {
    const { rows } = await summary(asUser(db, OWNER))
    const withdrawal = rows.find((r) => r.category_type === "withdrawal")
    expect(withdrawal).toMatchObject({ person_name: "Dueña", usdt_value: "-50.000000" })
  })

  it("owner sin aal2 no ve nada", async () => {
    const { rows } = await summary(asUser(db, OWNER, { aal: "aal1" }))
    expect(rows).toHaveLength(0)
  })

  it("staff solo suma lo que registró", async () => {
    const { rows } = await summary(asUser(db, STAFF, { aal: "aal1" }))
    expect(rows.map((r) => [r.month, r.category_type, Number(r.usdt_value)])).toEqual([["2026-09", "sales", 40]])
  })

  it("anon no puede llamarla", async () => {
    await expect(summary(asUser(db, null))).rejects.toThrow(/permission denied/)
  })
})
