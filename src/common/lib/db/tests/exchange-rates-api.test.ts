import { beforeAll, describe, expect, it } from "vitest"

import {
  asServiceRole,
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
})

describe("tasas automáticas (API)", () => {
  it("el servidor guarda una tasa de la API sin autor", async () => {
    const { rows } = await asServiceRole(db)<{ source: string; created_by: string | null }>(
      `insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt, source)
       values (857.8876, 974.7147, 958.5802, 'api') returning source, created_by`
    )
    expect(rows[0]).toEqual({ source: "api", created_by: null })
  })

  it("una tasa manual exige autor", async () => {
    await expect(
      asServiceRole(db)("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (1, 1, 1)")
    ).rejects.toThrow(/exchange_rates_manual_has_author/)
  })

  it("los usuarios no pueden marcar su tasa como de la API", async () => {
    await expect(
      asUser(db, OWNER)(
        "insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt, source) values (1, 1, 1, 'api')"
      )
    ).rejects.toThrow(/permission denied/)
  })

  it("una corrección manual queda como manual, con autor, y es la vigente", async () => {
    await asUser(db, OWNER)("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (860, 975, 960)")
    const { rows } = await asUser(db, STAFF)<{ source: string; binance_usdt: string; created_by: string }>(
      "select source, binance_usdt, created_by from public.current_exchange_rate"
    )
    expect(rows[0].source).toBe("manual")
    expect(Number(rows[0].binance_usdt)).toBe(960)
    expect(rows[0].created_by).toBe(OWNER)
  })

  it("staff sigue sin poder registrar si ya hay tasa de hoy (aunque sea de la API)", async () => {
    await expect(
      asUser(db, STAFF)("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (1, 1, 1)")
    ).rejects.toThrow(/row-level security/)
  })
})
