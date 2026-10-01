import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER } = TEST_USERS
const SEED = readFileSync(join(process.cwd(), "src/common/lib/supabase/seed-demo.sql"), "utf8")
const CONFIRM = "select set_config('app.demo_seed', 'tuestuchef-demo', false);"
const RANGE = "public.caracas_today() - 30, public.caracas_today()"

let db: TestDb
let owner: ReturnType<typeof asUser>

const count = async (sql: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) x`)).rows[0].n)

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  owner = asUser(db, OWNER)
}, 60_000)

describe("seed demo", () => {
  it("no corre sin la confirmación explícita", async () => {
    await expect(db.exec(SEED)).rejects.toThrow(/falta la confirmación/)
    expect(await count("select 1 from public.sales")).toBe(0)
  })

  it("carga un mes de operación", async () => {
    await db.exec(CONFIRM + "\n" + SEED)
    await db.exec("select set_config('app.demo_seed', '', false)")

    expect(await count("select 1 from public.exchange_rates")).toBe(31)
    expect(await count("select 1 from public.sales")).toBeGreaterThan(40)
    expect(await count("select 1 from public.sale_voids")).toBe(1)
    expect(await count("select 1 from public.purchases")).toBe(5)
    expect(await count("select 1 from public.production_runs")).toBeGreaterThan(10)
    expect(await count("select 1 from public.payroll_entries")).toBe(6)
    expect(await count("select 1 from public.account_transfers")).toBe(2)
    // Hay ventas por cobrar y compras por pagar (las vistas filtran por rol).
    expect((await owner("select 1 from public.receivables")).rows.length).toBeGreaterThan(0)
    expect((await owner("select 1 from public.payables")).rows.length).toBeGreaterThan(0)
    // Nada aparece como retroactivo.
    expect(await count("select 1 from public.sales where is_backdated or created_at <> occurred_at")).toBe(0)
    // Encargos: los dos más recientes siguen en producción y el resto ya se entregó.
    const pending = await owner("select 1 from public.sale_item_current_status where status in ('in_production', 'ready')")
    expect(pending.rows.length).toBe(2)
  })

  it("el dashboard tiene datos en todas las vistas", async () => {
    expect((await owner(`select * from public.cash_flow_by_account(${RANGE})`)).rows.length).toBeGreaterThan(3)
    expect((await owner(`select * from public.product_sales_margin(${RANGE})`)).rows.length).toBeGreaterThan(3)
    expect((await owner(`select * from public.exchange_rate_effect(${RANGE})`)).rows.length).toBeGreaterThan(0)
    expect((await owner(`select * from public.reserve_activity(${RANGE})`)).rows.length).toBeGreaterThan(0)
    const margins = await owner<{ unit_cost_usdt: string | null }>("select * from public.product_margins()")
    expect(margins.rows.some((r) => r.unit_cost_usdt !== null)).toBe(true)
  })

  it("no se ejecuta dos veces sobre una base con datos", async () => {
    await expect(db.exec(CONFIRM + "\n" + SEED)).rejects.toThrow(/ya tiene ventas o compras/)
    await db.exec("select set_config('app.demo_seed', '', false)")
  })

  it("el stock no queda negativo", async () => {
    const negative = await owner("select 1 from public.stock_balances where quantity < 0")
    expect(negative.rows.length).toBe(0)
  })
})

describe("seed demo sobre una base con tasas reales", () => {
  it("respeta las tasas existentes y parte de la última", async () => {
    const fresh = await createTestDb()
    await createUser(fresh, { id: OWNER, email: "owner@t.test", role: "owner" })
    const freshOwner = asUser(fresh, OWNER)
    await freshOwner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (200, 230, 300)")

    await fresh.exec(CONFIRM + "\n" + SEED)

    const rates = await fresh.query<{ n: number; today_bcv: string; oldest_binance: string }>(
      `select count(*)::int as n,
              (select bcv_usd from public.exchange_rates where rate_date = public.caracas_today()) as today_bcv,
              (select binance_usdt from public.exchange_rates order by rate_date limit 1) as oldest_binance
       from public.exchange_rates`
    )
    expect(rates.rows[0].n).toBe(31)
    expect(Number(rates.rows[0].today_bcv)).toBe(200)
    expect(Number(rates.rows[0].oldest_binance)).toBeGreaterThan(250)
  }, 60_000)
})
