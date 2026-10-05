import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]
const LAST_MONTH = "date_trunc('month', public.caracas_today())::date - interval '1 month'"
// Un día del mes pasado, a mediodía de Caracas.
const LAST_MONTH_AT = `((${LAST_MONTH})::date + 9)::timestamp at time zone 'America/Caracas' + interval '12 hours'`

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  await owner(`insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values ((${LAST_MONTH})::date + 9, 38, 42, 48)`)
  ids.cash = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))).id
  ids.cash2 = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja 2', 'USD', 'cash') returning id"))).id
  ids.income = (await one(owner<{ id: string }>("select id from public.movement_categories where is_system and type = 'sales'"))).id
  ids.rent = (await one(owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Alquiler', 'operating_expense') returning id"))).id
  await owner(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at) values
       ($1, 'income', $2, 500, ${LAST_MONTH_AT}), ($1, 'expense', $3, -200, ${LAST_MONTH_AT})`,
    [ids.cash, ids.income, ids.rent]
  )
})

describe("cierre de período", () => {
  it("solo owner y admin cierran, y solo meses terminados", async () => {
    await expect(staff(`select public.close_period((${LAST_MONTH})::date)`)).rejects.toThrow(/Solo owner y admin/)
    await expect(admin("select public.close_period(public.caracas_today())")).rejects.toThrow(/ya terminados/)
    await admin(`select public.close_period((${LAST_MONTH})::date)`)
    await expect(admin(`select public.close_period((${LAST_MONTH})::date)`)).rejects.toThrow(/ya está cerrado/)
  })

  it("guarda la foto de la utilidad del mes", async () => {
    const row = await one(owner<{ totals_snapshot: Record<string, number> }>(`select totals_snapshot from public.period_status where period = (${LAST_MONTH})::date`))
    expect(Number(row.totals_snapshot.sales)).toBe(500)
    expect(Number(row.totals_snapshot.operating_expense)).toBe(-200)
  })

  it("nadie registra con fecha de un mes cerrado: movimientos, reversos, traspasos ni stock", async () => {
    await expect(
      owner(`insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at) values ($1, 'expense', $2, -10, ${LAST_MONTH_AT})`, [
        ids.cash,
        ids.rent,
      ])
    ).rejects.toThrow(/está cerrado/)

    const entry = await one(owner<{ id: string }>("select id from public.ledger_entries where amount = -200"))
    await expect(owner("select public.reverse_ledger_entry($1, 'error')", [entry.id])).rejects.toThrow(/está cerrado/)

    await expect(
      owner(`select public.create_account_transfer($1, $2, 10, 10, ${LAST_MONTH_AT})`, [ids.cash, ids.cash2])
    ).rejects.toThrow(/está cerrado/)

    // Hoy sí se puede.
    await owner("insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ($1, 'expense', $2, -10)", [ids.cash, ids.rent])
  })

  it("staff no ve los cierres", async () => {
    expect((await staff("select * from public.period_status")).rows).toHaveLength(0)
  })

  it("solo el owner reabre, con motivo, y queda registrado", async () => {
    await expect(admin(`select public.reopen_period((${LAST_MONTH})::date, 'faltó un gasto')`)).rejects.toThrow(/Solo el owner/)
    await expect(owner(`select public.reopen_period((${LAST_MONTH})::date, '')`)).rejects.toThrow(/motivo/)
    await owner(`select public.reopen_period((${LAST_MONTH})::date, 'Faltó un gasto')`)
    await owner(`insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at) values ($1, 'expense', $2, -10, ${LAST_MONTH_AT})`, [
      ids.cash,
      ids.rent,
    ])
    const events = await owner<{ action: string }>(`select action from public.period_close_events where period = (${LAST_MONTH})::date order by created_at`)
    expect(events.rows.map((e) => e.action)).toEqual(["close", "reopen"])
    await expect(owner("delete from public.period_close_events")).rejects.toThrow()
  })
})
