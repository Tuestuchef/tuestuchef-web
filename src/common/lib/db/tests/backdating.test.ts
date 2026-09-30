import { beforeAll, describe, expect, it } from "vitest"

import {
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

// Fecha de Caracas N días atrás, y un instante al mediodía de ese día.
const daysAgo = async (n: number) =>
  (await db.query<{ d: string }>(`select to_char(public.caracas_today() - $1::int, 'YYYY-MM-DD') as d`, [n])).rows[0].d
const noon = (date: string) => `${date}T12:00:00-04:00`

const loadRate = (as: ReturnType<typeof asUser>, date: string, bcvUsd: number, binance: number) =>
  as("insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values ($1, $2, $3, $4)", [
    date,
    bcvUsd,
    bcvUsd * 1.1,
    binance,
  ])

const sell = (as: ReturnType<typeof asUser>, occurredAt: string | null, payments: { method: string; amount: number }[] = []) =>
  as<{ id: string }>(
    `select public.create_sale(
       p_channel => 'whatsapp', p_price_method_id => $1, p_delivery_method => 'pickup',
       p_items => $2::jsonb, p_payments => $3::jsonb, p_occurred_at => $4::timestamptz
     ) as id`,
    [
      ids.pagoMovil,
      JSON.stringify([{ variant_id: ids.variant, quantity: 1, source: "stock" }]),
      JSON.stringify(payments.map((p) => ({ payment_method_id: ids[p.method], amount: p.amount }))),
      occurredAt,
    ]
  ).then((r) => r.rows[0].id)

const saleRow = (id: string) =>
  owner<{ bcv_usd_rate: string; binance_rate: string; is_backdated: boolean; occurred_at: string }>(
    "select bcv_usd_rate, binance_rate, is_backdated, occurred_at from public.sales where id = $1",
    [id]
  ).then((r) => r.rows[0])

const income = (as: ReturnType<typeof asUser>, occurredAt: string, extra = "") =>
  as<{ bcv_usd_rate: string; binance_rate: string; usdt_value: string }>(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at${extra ? ", bcv_usd_rate, binance_rate, usd_usdt_rate" : ""})
     values ($1, 'income', $2, 1000, $3${extra ? `, ${extra}` : ""})
     returning bcv_usd_rate, binance_rate, usdt_value`,
    [ids.bank, ids.salesCategory, occurredAt]
  ).then((r) => r.rows[0])

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  // Hoy: BCV 40, Binance 50. Hace 3 días: BCV 30, Binance 35. Hace 10 días: BCV 20, Binance 25.
  await loadRate(owner, await daysAgo(0), 40, 50)
  await loadRate(owner, await daysAgo(3), 30, 35)
  await loadRate(admin, await daysAgo(10), 20, 25)

  ids.bank = (await owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id")).rows[0].id
  ids.pagoMovil = (
    await owner<{ id: string }>(
      "insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'USD', 'bcv_usd') returning id",
      [ids.bank]
    )
  ).rows[0].id
  ids.salesCategory = (await owner<{ id: string }>("select id from public.movement_categories where is_system and type = 'sales'")).rows[0].id

  const cat = (await owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id")).rows[0].id
  const product = (
    await owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Filipina', 'stock') returning id", [cat])
  ).rows[0].id
  ids.variant = (await owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [product])).rows[0].id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [product, ids.pagoMovil])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 100, 8)", [ids.variant])
})

describe("tasas de fechas pasadas", () => {
  it("owner y admin cargan tasas de fechas pasadas; no se editan", async () => {
    const date = await daysAgo(20)
    await loadRate(admin, date, 15, 18)
    // Sin permiso de edición y, además, inmutable por trigger.
    await expect(owner("update public.exchange_rates set bcv_usd = 1 where rate_date = $1", [date])).rejects.toThrow(
      /permission denied|no se editan/
    )
    await expect(db.query("update public.exchange_rates set bcv_usd = 1 where rate_date = $1", [date])).rejects.toThrow(
      /no se editan/
    )
  })

  it("staff no carga tasas de fechas pasadas", async () => {
    await expect(loadRate(staff, await daysAgo(5), 1, 1)).rejects.toThrow(/row-level security/)
  })
})

describe("ventas con fecha pasada", () => {
  it("usa las tasas de esa fecha y queda marcada como retroactiva", async () => {
    // 25 USD × BCV 30 (hace 3 días) = 750 Bs.
    const sale = await sell(staff, noon(await daysAgo(3)), [{ method: "pagoMovil", amount: 750 }])
    const row = await saleRow(sale)
    expect(Number(row.bcv_usd_rate)).toBe(30)
    expect(Number(row.binance_rate)).toBe(35)
    expect(row.is_backdated).toBe(true)

    const summary = await owner<{ payment_status: string; collected_usdt: string }>(
      "select payment_status, collected_usdt from public.sales_summary where sale_id = $1",
      [sale]
    )
    expect(summary.rows[0].payment_status).toBe("paid")
    // Valor real con la Binance de esa fecha: 750 ÷ 35.
    expect(Number(summary.rows[0].collected_usdt)).toBeCloseTo(750 / 35, 5)

    const payment = await owner<{ is_backdated: boolean; occurred_at: string }>(
      "select is_backdated from public.sale_payments where sale_id = $1",
      [sale]
    )
    expect(payment.rows[0].is_backdated).toBe(true)
  })

  it("una venta de hoy no es retroactiva", async () => {
    const sale = await sell(staff, null)
    expect((await saleRow(sale)).is_backdated).toBe(false)
  })

  it("staff queda bloqueado más allá del límite; owner y admin no", async () => {
    const tenDaysAgo = noon(await daysAgo(10))
    await expect(sell(staff, tenDaysAgo)).rejects.toThrow(/hasta 7 días atrás/)
    const sale = await sell(admin, tenDaysAgo)
    expect(Number((await saleRow(sale)).bcv_usd_rate)).toBe(20)
  })

  it("el límite de staff es configurable", async () => {
    await admin("update public.sales_settings set staff_max_backdate_days = 10")
    await expect(sell(staff, noon(await daysAgo(10)))).resolves.toBeTruthy()
    await admin("update public.sales_settings set staff_max_backdate_days = 7")
  })

  it("rechaza fechas futuras", async () => {
    const tomorrow = (await db.query<{ d: string }>("select to_char(public.caracas_today() + 1, 'YYYY-MM-DD') as d")).rows[0].d
    await expect(sell(owner, noon(tomorrow))).rejects.toThrow(/no puede ser futura/)
    await expect(sell(staff, new Date(Date.now() + 60 * 60 * 1000).toISOString())).rejects.toThrow(/no puede ser futura/)
  })

  it("se bloquea si no hay tasas para esa fecha", async () => {
    await expect(sell(owner, noon(await daysAgo(5)))).rejects.toThrow(/No hay tasas registradas para el .*Owner o admin/)
  })
})

describe("pagos con fecha pasada", () => {
  it("un abono con fecha pasada usa la tasa de su fecha", async () => {
    const sale = await sell(owner, noon(await daysAgo(10)))
    // Abono hace 3 días: 300 Bs ÷ BCV 30 = 10 USD.
    await staff("select public.add_sale_payment($1, $2, 300, null, $3)", [sale, ids.pagoMovil, noon(await daysAgo(3))])
    const row = await owner<{ usd_amount: string; applied_rate: string }>(
      "select usd_amount, applied_rate from public.sale_payments where sale_id = $1",
      [sale]
    )
    expect(Number(row.rows[0].applied_rate)).toBe(30)
    expect(Number(row.rows[0].usd_amount)).toBe(10)
  })

  it("un pago no puede ser anterior a la venta", async () => {
    const sale = await sell(owner, noon(await daysAgo(3)))
    await expect(
      owner("select public.add_sale_payment($1, $2, 100, null, $3)", [sale, ids.pagoMovil, noon(await daysAgo(10))])
    ).rejects.toThrow(/anterior a la venta/)
  })
})

describe("movimientos del libro con fecha pasada", () => {
  it("usan las tasas de esa fecha aunque se envíen otras", async () => {
    const row = await income(owner, noon(await daysAgo(3)), "999, 999, 1")
    expect(Number(row.bcv_usd_rate)).toBe(30)
    expect(Number(row.binance_rate)).toBe(35)
    expect(Number(row.usdt_value)).toBeCloseTo(1000 / 35, 5)
  })

  it("staff queda bloqueado más allá del límite", async () => {
    await expect(income(staff, noon(await daysAgo(10)))).rejects.toThrow(/hasta 7 días atrás/)
    await expect(income(staff, noon(await daysAgo(3)))).resolves.toBeTruthy()
  })

  it("se bloquean sin tasas de esa fecha y con fecha futura", async () => {
    await expect(income(owner, noon(await daysAgo(5)))).rejects.toThrow(/No hay tasas registradas/)
    const tomorrow = (await db.query<{ d: string }>("select to_char(public.caracas_today() + 1, 'YYYY-MM-DD') as d")).rows[0].d
    await expect(income(owner, noon(tomorrow))).rejects.toThrow(/futura/)
  })
})
