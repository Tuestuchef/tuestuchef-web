import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const settings = async () =>
  (await owner<{ number_prefix: string; next_number: number; vat_percent: string; updated_by: string | null }>("select * from public.quote_settings")).rows[0]

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  const usd = (await owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id")).rows[0]
  const ves = (await owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id")).rows[0]
  ids.cash = (
    await owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [usd.id])
  ).rows[0].id
  ids.mobile = (
    await owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'VES', 'bcv_usd') returning id", [ves.id])
  ).rows[0].id
})

describe("configuración de presupuestos", () => {
  it("arranca con TLT, número 1, 7 días e IVA 16% y todos la leen", async () => {
    const row = (await staff<{ number_prefix: string; next_number: number; validity_days: number; vat_percent: string }>("select * from public.quote_settings")).rows[0]
    expect(row).toMatchObject({ number_prefix: "TLT", next_number: 1, validity_days: 7, vat_percent: "16.00" })
  })

  it("solo owner y admin la editan, y queda quién", async () => {
    await staff("update public.quote_settings set validity_days = 30")
    expect((await owner<{ validity_days: number }>("select validity_days from public.quote_settings")).rows[0].validity_days).toBe(7)
    await owner("update public.quote_settings set next_number = 9574, validity_days = 10")
    expect(await settings()).toMatchObject({ next_number: 9574, updated_by: OWNER })
  })

  it("el siguiente número solo sube", async () => {
    await expect(owner("update public.quote_settings set next_number = 100")).rejects.toThrow(/solo puede aumentar/)
  })

  it("cada lista por defecto es de un método de su moneda", async () => {
    await owner("update public.quote_settings set default_usd_price_method_id = $1, default_ves_price_method_id = $2", [ids.cash, ids.mobile])
    await expect(owner("update public.quote_settings set default_usd_price_method_id = $1", [ids.mobile])).rejects.toThrow(/dólares/)
    await expect(owner("update public.quote_settings set default_ves_price_method_id = $1", [ids.cash])).rejects.toThrow(/bolívares/)
  })

  it("el prefijo solo lleva mayúsculas, números o guion", async () => {
    await expect(owner("update public.quote_settings set number_prefix = 'tl t'")).rejects.toThrow(/check/)
  })
})
