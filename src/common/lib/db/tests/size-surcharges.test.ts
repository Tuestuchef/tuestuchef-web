import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const sell = (as: ReturnType<typeof asUser>, variant: string, method = ids.cash) =>
  one(
    as<{ id: string }>(
      `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup', p_items => $2::jsonb) as id`,
      [method, JSON.stringify([{ variant_id: ids[variant], quantity: 1, source: "stock" }])]
    )
  ).then((r) => r.id)

const unitPrice = async (saleId: string) =>
  (await one(owner<{ unit_price_usd: string }>("select unit_price_usd from public.sale_items where sale_id = $1", [saleId]))).unit_price_usd

const price = async (variant: string, method = ids.cash) =>
  (await one(owner<{ price: string | null }>("select public.variant_price_usd($1, $2) as price", [ids[variant], method]))).price

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const usd = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  const ves = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id"))
  ids.cash = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [usd.id]))
  ).id
  ids.mobile = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'USD', 'bcv_usd') returning id", [ves.id]))
  ).id
  ids.zelle = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Zelle', $1, 'USD', 'none') returning id", [usd.id]))
  ).id

  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  ids.sizeM = (await one(owner<{ id: string }>("select id from public.sizes where code = 'M'"))).id
  ids.size3xl = (await one(owner<{ id: string }>("insert into public.sizes (name, code, sort_order) values ('3XL', '3XL', 7) returning id"))).id
  ids.product = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Filipina manga corta broche', 'stock') returning id", [category.id]))
  ).id
  ids.shirtM = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, size_id, sku) values ($1, $2, 'FIL-MC-BR-M') returning id", [ids.product, ids.sizeM]))).id
  ids.shirt3xl = (
    await one(owner<{ id: string }>("insert into public.product_variants (product_id, size_id, sku) values ($1, $2, 'FIL-MC-BR-3XL') returning id", [ids.product, ids.size3xl]))
  ).id
  // Sin precio en Zelle: el recargo no inventa un precio.
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 45), ($1, $3, 45)", [ids.product, ids.cash, ids.mobile])
  for (const variant of ["shirtM", "shirt3xl"]) {
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity) values ($1, 'initial_count', 20)", [ids[variant]])
  }

  ids.combo = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, kind, fulfillment_type) values ($1, 'Combo', 'combo', 'made_to_order') returning id", [category.id]))
  ).id
})

describe("recargo por talla", () => {
  it("solo owner y admin lo cargan; todo el equipo lo ve", async () => {
    await expect(
      staff("insert into public.size_surcharges (size_id, product_id, amount_usd) values ($1, $2, 5)", [ids.size3xl, ids.product])
    ).rejects.toThrow()
    await owner("insert into public.size_surcharges (size_id, product_id, amount_usd) values ($1, $2, 5)", [ids.size3xl, ids.product])
    expect((await staff("select * from public.size_surcharges")).rows).toHaveLength(1)
    const removed = await staff("delete from public.size_surcharges returning size_id")
    expect(removed.rows).toHaveLength(0)
  })

  it("el precio de la variante suma el recargo de su talla en cada método", async () => {
    expect(await price("shirtM")).toBe("45.00")
    expect(await price("shirt3xl")).toBe("50.00")
    expect(await price("shirt3xl", ids.mobile)).toBe("50.00")
    expect(await price("shirt3xl", ids.zelle)).toBeNull()
  })

  it("la venta cobra el precio con recargo (también en Bs) y la de otra talla no", async () => {
    expect(await unitPrice(await sell(staff, "shirt3xl"))).toBe("50.00")
    expect(await unitPrice(await sell(staff, "shirtM"))).toBe("45.00")
    const bs = await sell(staff, "shirt3xl", ids.mobile)
    expect(await unitPrice(bs)).toBe("50.00")
    expect((await one(owner<{ bcv_usd_rate: string }>("select bcv_usd_rate from public.sales where id = $1", [bs]))).bcv_usd_rate).toBe("40.00000000")
  })

  it("el presupuesto lleva el recargo en ambas listas", async () => {
    const payload = {
      customer: { name: "Hotel Ávila" },
      currencies: "both",
      usd_price_method_id: ids.cash,
      ves_price_method_id: ids.mobile,
      items: [{ variant_id: ids.shirt3xl, quantity: 2 }],
    }
    const quoteId = (await one(staff<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [JSON.stringify(payload)]))).id
    const item = await one(
      owner<{ usd_unit_price: string; ves_unit_price: string; usd_line_total: string }>(
        "select usd_unit_price, ves_unit_price, usd_line_total from public.quote_items where quote_id = $1",
        [quoteId]
      )
    )
    expect(item).toEqual({ usd_unit_price: "50.00", ves_unit_price: "50.00", usd_line_total: "100.00" })
  })

  it("el margen usa el precio de cada talla", async () => {
    const rows = (
      await owner<{ sku: string; price_usd: string }>(
        "select sku, price_usd from public.product_margins() where product_id = $1 and payment_method_id = $2 order by sku",
        [ids.product, ids.cash]
      )
    ).rows
    expect(rows).toEqual([
      { sku: "FIL-MC-BR-3XL", price_usd: "50.00" },
      { sku: "FIL-MC-BR-M", price_usd: "45.00" },
    ])
  })

  it("no aplica a combos y quitarlo no cambia lo ya vendido", async () => {
    await expect(
      owner("insert into public.size_surcharges (size_id, product_id, amount_usd) values ($1, $2, 5)", [ids.size3xl, ids.combo])
    ).rejects.toThrow(/solo para productos terminados/)

    const sold = await sell(staff, "shirt3xl")
    await owner("delete from public.size_surcharges where product_id = $1", [ids.product])
    expect(await price("shirt3xl")).toBe("45.00")
    expect(await unitPrice(sold)).toBe("50.00")
  })

  it("el monto es positivo", async () => {
    await expect(
      owner("insert into public.size_surcharges (size_id, product_id, amount_usd) values ($1, $2, 0)", [ids.size3xl, ids.product])
    ).rejects.toThrow(/check/)
  })
})
