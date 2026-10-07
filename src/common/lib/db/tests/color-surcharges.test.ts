import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const sell = (variant: string) =>
  one(
    staff<{ id: string }>(
      `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup', p_items => $2::jsonb) as id`,
      [ids.cash, JSON.stringify([{ variant_id: ids[variant], quantity: 1, source: "stock" }])]
    )
  ).then((r) => r.id)

const unitPrice = async (saleId: string) =>
  (await one(owner<{ unit_price_usd: string }>("select unit_price_usd from public.sale_items where sale_id = $1", [saleId]))).unit_price_usd

const price = async (variant: string) =>
  (await one(owner<{ price: string | null }>("select public.variant_price_usd($1, $2) as price", [ids[variant], ids.cash]))).price

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const usd = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  ids.cash = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [usd.id]))
  ).id

  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Pantalones', 'PAN') returning id"))
  ids.black = (await one(owner<{ id: string }>("insert into public.colors (name, code) values ('Negro', 'NEG') returning id"))).id
  ids.houndstooth = (await one(owner<{ id: string }>("insert into public.colors (name, code) values ('Pata de gallo', 'PDG') returning id"))).id
  ids.sizeM = (await one(owner<{ id: string }>("select id from public.sizes where code = 'M'"))).id
  ids.size3xl = (await one(owner<{ id: string }>("insert into public.sizes (name, code, sort_order) values ('3XL', '3XL', 7) returning id"))).id
  ids.product = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, fit, fulfillment_type) values ($1, 'Pantalón recto', 'straight', 'stock') returning id", [category.id]))
  ).id
  const variant = async (key: string, color: string, size: string, sku: string) => {
    ids[key] = (
      await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, size_id, sku) values ($1, $2, $3, $4) returning id", [ids.product, ids[color], ids[size], sku]))
    ).id
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity) values ($1, 'initial_count', 20)", [ids[key]])
  }
  await variant("blackM", "black", "sizeM", "PAN-RE-NEG-M")
  await variant("pdgM", "houndstooth", "sizeM", "PAN-RE-PDG-M")
  await variant("pdg3xl", "houndstooth", "size3xl", "PAN-RE-PDG-3XL")
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [ids.product, ids.cash])

  ids.combo = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, kind, fulfillment_type) values ($1, 'Combo', 'combo', 'made_to_order') returning id", [category.id]))
  ).id
})

describe("recargo por color", () => {
  it("solo owner y admin lo cargan; todo el equipo lo ve", async () => {
    await expect(
      staff("insert into public.color_surcharges (color_id, product_id, amount_usd) values ($1, $2, 2)", [ids.houndstooth, ids.product])
    ).rejects.toThrow()
    await owner("insert into public.color_surcharges (color_id, product_id, amount_usd) values ($1, $2, 2)", [ids.houndstooth, ids.product])
    expect((await staff("select * from public.color_surcharges")).rows).toHaveLength(1)
    expect((await staff("delete from public.color_surcharges returning color_id")).rows).toHaveLength(0)
  })

  it("el precio suma el recargo del color; otros colores no", async () => {
    expect(await price("blackM")).toBe("25.00")
    expect(await price("pdgM")).toBe("27.00")
  })

  it("si la variante tiene recargo de talla y de color, se suman los dos", async () => {
    await owner("insert into public.size_surcharges (size_id, product_id, amount_usd) values ($1, $2, 3)", [ids.size3xl, ids.product])
    expect(await price("pdg3xl")).toBe("30.00")
  })

  it("la venta cobra el precio con el recargo del color", async () => {
    expect(await unitPrice(await sell("pdgM"))).toBe("27.00")
    expect(await unitPrice(await sell("blackM"))).toBe("25.00")
  })

  it("el margen usa el precio con los recargos", async () => {
    const rows = (
      await owner<{ sku: string; price_usd: string }>("select sku, price_usd from public.product_margins() where product_id = $1 order by sku", [ids.product])
    ).rows
    expect(rows).toEqual([
      { sku: "PAN-RE-NEG-M", price_usd: "25.00" },
      { sku: "PAN-RE-PDG-3XL", price_usd: "30.00" },
      { sku: "PAN-RE-PDG-M", price_usd: "27.00" },
    ])
  })

  it("no aplica a combos y el monto es positivo", async () => {
    await expect(
      owner("insert into public.color_surcharges (color_id, product_id, amount_usd) values ($1, $2, 2)", [ids.houndstooth, ids.combo])
    ).rejects.toThrow(/solo para productos terminados/)
    await expect(
      owner("insert into public.color_surcharges (color_id, product_id, amount_usd) values ($1, $2, 0)", [ids.black, ids.product])
    ).rejects.toThrow(/check/)
  })
})
