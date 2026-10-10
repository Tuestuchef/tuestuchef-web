import { randomUUID } from "node:crypto"

import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

type Custom = { type: string; quantity?: number; text?: string; names?: string[]; logo?: string; charged?: boolean }

const items = (quantity: number, customizations: Custom[]) => [
  {
    variant_id: ids.variant,
    quantity,
    source: "stock",
    customizations: customizations.map((c) => ({
      type_id: ids[c.type],
      quantity: c.quantity,
      text: c.text,
      names: c.names,
      logo_path: c.logo,
      charged: c.charged,
    })),
  },
]

const sell = async (as: ReturnType<typeof asUser>, quantity: number, customizations: Custom[], paid = 0) =>
  (
    await one(
      as<{ id: string }>(
        `select public.create_sale('in_person', $1, 'pickup', $2::jsonb, $3::jsonb, p_delivered => true) as id`,
        [ids.cash, JSON.stringify(items(quantity, customizations)), JSON.stringify(paid ? [{ payment_method_id: ids.cash, amount: paid }] : [])]
      )
    )
  ).id

const customizations = (saleId: string) =>
  owner<{ charged: boolean; unit_price_usd: string; line_total_usd: string; text: string | null; type: string }>(
    `select c.charged, c.unit_price_usd, c.line_total_usd, c.text, t.code as type
     from public.sale_item_customizations c
     join public.customization_types t on t.id = c.customization_type_id
     join public.sale_items i on i.id = c.sale_item_id
     where i.sale_id = $1 order by t.sort_order`,
    [saleId]
  ).then((r) => r.rows)

const total = (saleId: string) =>
  one(owner<{ total_usd: string }>("select total_usd from public.sales where id = $1", [saleId])).then((r) => Number(r.total_usd))

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const account = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  ids.cash = (
    await one(
      owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [account.id])
    )
  ).id
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Estuches', 'EST') returning id"))
  const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Estuche') returning id", [category.id]))
  ids.variant = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'EST-1') returning id", [product.id]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 35)", [product.id, ids.cash])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 50, 8)", [ids.variant])
  for (const code of ["embroidered_name", "pocket_logo"]) {
    ids[code] = (await one(owner<{ id: string }>("select id from public.customization_types where code = $1", [code]))).id
  }
})

describe("personalización en ventas rápidas", () => {
  it("cobrada suma el precio del tipo al total y los pagos cuentan contra ese total", async () => {
    const id = await sell(staff, 1, [{ type: "embroidered_name", text: "Chef Ana" }], 39)
    expect(await total(id)).toBe(39)
    expect(await customizations(id)).toMatchObject([{ charged: true, unit_price_usd: "4.00", line_total_usd: "4.00", text: "Chef Ana" }])
    const summary = await one(owner<{ payment_status: string }>("select payment_status from public.sales_summary where sale_id = $1", [id]))
    expect(summary.payment_status).toBe("paid")
  })

  it("sin cobrar solo queda anotada, sin mínimo de piezas y sin archivo de logo (aunque el tipo no tenga precio)", async () => {
    const id = await sell(staff, 1, [{ type: "pocket_logo", text: "Logo Restaurante Mar", charged: false }])
    expect(await total(id)).toBe(35)
    expect(await customizations(id)).toMatchObject([{ charged: false, unit_price_usd: "0.00", line_total_usd: "0.00", text: "Logo Restaurante Mar" }])
  })

  it("cobrar un tipo sin precio, o sin decir qué lleva, no pasa", async () => {
    await expect(sell(staff, 1, [{ type: "pocket_logo", text: "Logo" }])).rejects.toThrow(/no tiene precio/)
    await expect(sell(staff, 1, [{ type: "embroidered_name" }])).rejects.toThrow(/escribe el nombre/)
    await expect(sell(staff, 2, [{ type: "embroidered_name", names: ["Ana"] }])).rejects.toThrow(/1 nombres para 2 piezas/)
    await expect(sell(staff, 1, [{ type: "embroidered_name", quantity: 2, text: "Ana" }])).rejects.toThrow(/van de 1/)
  })

  it("un nombre por pieza queda guardado en orden", async () => {
    const id = await sell(staff, 2, [{ type: "embroidered_name", names: ["Ana", "Luis"] }])
    expect(await total(id)).toBe(78)
    const names = await owner<{ name: string }>(
      `select n.name from public.sale_item_customization_names n
       join public.sale_item_customizations c on c.id = n.customization_id
       join public.sale_items i on i.id = c.sale_item_id
       where i.sale_id = $1 order by n.ordinal`,
      [id]
    )
    expect(names.rows.map((r) => r.name)).toEqual(["Ana", "Luis"])
  })

  it("la venta sin conexión la lleva igual", async () => {
    const result = await one(
      staff<{ result: { status: string; sale_id: string } }>("select public.sync_offline_sale($1, $2::jsonb) as result", [
        randomUUID(),
        JSON.stringify({
          channel: "in_person",
          price_method_id: ids.cash,
          delivery_method: "pickup",
          items: items(1, [{ type: "embroidered_name", text: "Luis" }]),
          payments: [],
          delivered: true,
        }),
      ])
    )
    expect(result.result.status).toBe("created")
    expect(await total(result.result.sale_id)).toBe(39)
    expect(await customizations(result.result.sale_id)).toHaveLength(1)
  })
})
