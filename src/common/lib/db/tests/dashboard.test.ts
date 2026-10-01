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

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]
const PERIOD = "public.caracas_today(), public.caracas_today()"

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  // BCV 40, Binance 50: cobrar en Bs a BCV vale 20% menos en valor real.
  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const accounts = await owner<{ id: string; name: string }>(
    `insert into public.accounts (name, currency, kind) values
       ('Banco', 'VES', 'bank'), ('Efectivo', 'USD', 'cash'), ('Binance', 'USDT', 'crypto_wallet'), ('Reserva', 'USDT', 'crypto_wallet')
     returning id, name`
  )
  for (const a of accounts.rows) ids[a.name] = a.id
  const income = (await one(owner<{ id: string }>("select id from public.movement_categories where is_system and type = 'sales'"))).id
  ids.cost = (await one(owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Telas', 'cost') returning id"))).id
  // Saldos iniciales "de ayer" para probar el saldo de apertura.
  await owner("insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values (public.caracas_today() - 1, 40, 44, 50)")
  await owner(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount, occurred_at) values
       ($1, 'income', $4, 100000, now() - interval '1 day'),
       ($2, 'income', $4, 500, now() - interval '1 day'),
       ($3, 'income', $4, 1000, now() - interval '1 day')`,
    [ids.Banco, ids.Efectivo, ids.Binance, income]
  )

  ids.pagoMovil = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'USD', 'bcv_usd') returning id", [ids.Banco]))
  ).id
  const category = (await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))).id
  ids.product = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type, labor_cost_usdt) values ($1, 'Filipina', 'stock', 3) returning id", [category]))
  ).id
  ids.variant = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [ids.product]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [ids.product, ids.pagoMovil])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 50, 8)", [ids.variant])
  ids.supplier = (await one(owner<{ id: string }>("insert into public.suppliers (name) values ('Textiles') returning id"))).id

  const sell = (quantity: number, discount: number | null, payBs: number) =>
    owner<{ id: string }>(
      `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup',
         p_items => $2::jsonb, p_payments => $3::jsonb, p_discount_type => $4::public.discount_type, p_discount_value => $5,
         p_discount_reason => $6) as id`,
      [
        ids.pagoMovil,
        JSON.stringify([{ variant_id: ids.variant, quantity, source: "stock" }]),
        JSON.stringify([{ payment_method_id: ids.pagoMovil, amount: payBs }]),
        discount ? "percent" : null,
        discount,
        discount ? "Cliente frecuente" : null,
      ]
    ).then((r) => r.rows[0].id)

  // Venta 1: 2 filipinas a 25 con 10% = 45 USD → 1.800 Bs a BCV 40 → 36 USDT reales.
  await sell(2, 10, 1800)
  // Venta 2 (se anula): no cuenta ni en margen ni en el efecto de la tasa.
  const voided = await sell(1, null, 1000)
  await owner("select public.void_sale($1, 'Error')", [voided])

  // Compra a crédito de 50 USD pagada con 2.000 Bs a tasa BCV → 40 USDT reales.
  const purchase = (
    await one(owner<{ id: string }>(
      `select public.create_purchase(p_supplier_id => $1, p_items => $2::jsonb, p_due_date => public.caracas_today()) as id`,
      [ids.supplier, JSON.stringify([{ line_type: "concept", description: "Maquila", quantity: 1, unit_cost_usd: 50, category_id: ids.cost }])]
    ))
  ).id
  await owner("select public.add_purchase_payment($1, $2, 2000, 'bcv_usd')", [purchase, ids.Banco])

  // 100 USDT de Binance a la reserva.
  await owner("select public.create_account_transfer($1, $2, 100, 100)", [ids.Binance, ids.Reserva])
})

describe("dashboard: permisos", () => {
  it("staff no ve nada del dashboard", async () => {
    for (const fn of ["cash_flow_by_account", "product_sales_margin", "exchange_rate_effect", "reserve_activity"]) {
      expect((await staff(`select * from public.${fn}(${PERIOD})`)).rows).toHaveLength(0)
    }
    expect((await staff("select * from public.profit_policy")).rows).toHaveLength(0)
    const updated = await staff("update public.profit_policy set reserve_percent = 50 returning *")
    expect(updated.rows).toHaveLength(0)
  })
})

describe("flujo de caja por cuenta", () => {
  it("saldo de apertura, entradas, salidas y cierre del período", async () => {
    const rows = await owner<{ name: string; opening: string; inflows: string; outflows: string; closing: string }>(
      `select name, opening, inflows, outflows, closing from public.cash_flow_by_account(${PERIOD})`
    )
    const bank = rows.rows.find((r) => r.name === "Banco")!
    // Abre con 100.000 Bs; entran 1.800 + 1.000 (venta anulada) y salen 1.000 (reverso) + 2.000 (proveedor).
    expect(Number(bank.opening)).toBe(100000)
    expect(Number(bank.inflows)).toBe(2800)
    expect(Number(bank.outflows)).toBe(3000)
    expect(Number(bank.closing)).toBe(99800)
    const reserve = rows.rows.find((r) => r.name === "Reserva")!
    expect([Number(reserve.opening), Number(reserve.inflows), Number(reserve.closing)]).toEqual([0, 100, 100])
  })
})

describe("margen por producto", () => {
  it("ingreso real con descuento y tasa, menos costo y mano de obra; sin ventas anuladas", async () => {
    const row = await one(admin<{ units: string; revenue_usd: string; revenue_usdt: string; material_cost_usdt: string; labor_cost_usdt: string; margin_usdt: string; lines_without_cost: number }>(
      `select * from public.product_sales_margin(${PERIOD})`
    ))
    // 45 USD × 40/50 = 36 USDT; costo 2 × 8 = 16; mano de obra 2 × 3 = 6; margen 14.
    expect(Number(row.units)).toBe(2)
    expect(Number(row.revenue_usd)).toBe(45)
    expect(Number(row.revenue_usdt)).toBe(36)
    expect(Number(row.material_cost_usdt)).toBe(16)
    expect(Number(row.labor_cost_usdt)).toBe(6)
    expect(Number(row.margin_usdt)).toBe(14)
    expect(row.lines_without_cost).toBe(0)
  })
})

describe("efecto de la tasa", () => {
  it("ventas cobradas en Bs pierden valor real; pagos a proveedores a BCV ganan", async () => {
    const rows = await owner<{ source: string; nominal_usdt: string; real_usdt: string; difference_usdt: string }>(
      `select source, nominal_usdt, real_usdt, difference_usdt from public.exchange_rate_effect(${PERIOD}) order by source`
    )
    const purchase = rows.rows.find((r) => r.source === "purchase")!
    const sale = rows.rows.find((r) => r.source === "sale")!
    // Venta: 45 USD nominales, 36 reales → −9. La anulada no cuenta.
    expect([Number(sale.nominal_usdt), Number(sale.real_usdt), Number(sale.difference_usdt)]).toEqual([45, 36, -9])
    // Compra: deuda de 50 USD pagada con 40 USDT reales → +10.
    expect([Number(purchase.nominal_usdt), Number(purchase.real_usdt), Number(purchase.difference_usdt)]).toEqual([50, 40, 10])
  })
})

describe("política de utilidad y reserva", () => {
  it("la cuenta de reserva debe ser en USDT y los porcentajes no pasan de 100", async () => {
    await expect(admin("update public.profit_policy set reserve_account_id = $1", [ids.Banco])).rejects.toThrow(/en USDT/)
    await expect(admin("update public.profit_policy set reserve_percent = 70, reinvestment_percent = 40")).rejects.toThrow(/profit_policy_total/)
    await admin("update public.profit_policy set reserve_account_id = $1, reserve_percent = 10, reinvestment_percent = 20", [ids.Reserva])
    const policy = await one(owner<{ updated_by: string }>("select updated_by from public.profit_policy"))
    expect(policy.updated_by).toBe(ADMIN)
  })

  it("lo transferido a la reserva en el período y su saldo", async () => {
    const row = await one(owner<{ account_name: string; transferred_usdt: string; balance_usdt: string }>(
      `select * from public.reserve_activity(${PERIOD})`
    ))
    expect(row).toMatchObject({ account_name: "Reserva" })
    expect(Number(row.transferred_usdt)).toBe(100)
    expect(Number(row.balance_usdt)).toBe(100)
  })
})
