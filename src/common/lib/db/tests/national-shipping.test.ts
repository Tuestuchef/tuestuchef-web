import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  owner = asUser(db, OWNER)
  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const account = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  ids.cash = (
    await one(
      owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [account.id])
    )
  ).id
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina') returning id", [category.id]))
  ids.variant = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [product.id]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [product.id, ids.cash])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 5, 8)", [ids.variant])
})

describe("envío nacional", () => {
  it("una venta puede ir por envío nacional, con su cobro aparte", async () => {
    const sale = await one(
      owner<{ id: string }>(
        `select public.create_sale('whatsapp', $1, 'national_shipping', $2::jsonb, p_delivery_fee_usd => 6) as id`,
        [ids.cash, JSON.stringify([{ variant_id: ids.variant, quantity: 1, source: "stock" }])]
      )
    )
    const row = await one(owner<{ delivery_method: string; total_usd: string }>("select delivery_method, total_usd from public.sales where id = $1", [sale.id]))
    expect(row).toMatchObject({ delivery_method: "national_shipping", total_usd: "31.00" })
  })
})
