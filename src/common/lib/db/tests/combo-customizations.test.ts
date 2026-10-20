import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

type Custom = { type: string; quantity?: number; text?: string; names?: string[]; logo?: string; charged?: boolean }

const custom = (c: Custom) => ({
  type_id: ids[c.type],
  quantity: c.quantity,
  text: c.text,
  names: c.names,
  logo_path: c.logo,
  charged: c.charged,
})

const NAMES = Array.from({ length: 10 }, (_, i) => `Chef ${i + 1}`)

// Promo 10x10: 10 delantales y 10 gorros. Por defecto: logo incluido en los delantales y un nombre
// cobrado en cada gorro.
const promo = (
  extra: Record<string, unknown> = {},
  apron: Custom[] = [{ type: "pocket_logo", logo: "logos/escuela.png", text: "Logo escuela", charged: false }],
  cap: Custom[] = [{ type: "embroidered_name", names: NAMES }]
) => ({
  variant_id: ids.comboV,
  quantity: 1,
  components: [
    { variant_id: ids.apron, quantity: 10, customizations: apron.map(custom) },
    { variant_id: ids.cap, quantity: 10, customizations: cap.map(custom) },
  ],
  ...extra,
})

const sell = (items: object[]) =>
  one(
    staff<{ id: string }>(`select public.create_sale('in_person', $1, 'pickup', $2::jsonb, '[]'::jsonb) as id`, [ids.cash, JSON.stringify(items)])
  ).then((r) => r.id)

const order = (items: object[]) =>
  one(
    staff<{ id: string }>(
      `select public.create_order(
         p_customer_id => $1, p_price_method_id => $2, p_channel => 'whatsapp', p_delivery_method => 'pickup',
         p_items => $3::jsonb, p_stock_mode => 'produce_all'
       ) as id`,
      [ids.customer, ids.cash, JSON.stringify(items)]
    )
  ).then((r) => r.id)

// Personalización guardada por pieza: de qué producto, si se cobró, cuánto y cuántos nombres.
const saved = (saleId: string) =>
  owner<{ product: string; on_child: boolean; charged: boolean; line_total_usd: string; names: string }>(
    `select p.name as product, i.parent_item_id is not null as on_child, c.charged, c.line_total_usd,
            (select count(*) from public.sale_item_customization_names n where n.customization_id = c.id)::text as names
     from public.sale_item_customizations c
     join public.sale_items i on i.id = c.sale_item_id
     join public.product_variants v on v.id = i.variant_id
     join public.products p on p.id = v.product_id
     where i.sale_id = $1 order by p.name`,
    [saleId]
  ).then((r) => r.rows)

const total = (saleId: string) =>
  one(owner<{ total_usd: string }>("select total_usd from public.sales where id = $1", [saleId])).then((r) => Number(r.total_usd))

// 10 nombres a 4 USD, con el descuento al mayor de personalización que corresponda a 10 piezas.
const namesTotal = () =>
  one(owner<{ v: string }>("select round(10 * 4 * (1 - public.volume_discount_percent('customization', 10) / 100), 2) as v")).then((r) => Number(r.v))

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
  ids.customer = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Escuela', '+584141234567') returning id"))).id

  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Cocina', 'COC') returning id"))
  for (const [key, name] of [
    ["apron", "Delantal"],
    ["cap", "Gorro"],
  ]) {
    const product = await one(
      owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, $2, 'both') returning id", [category.id, name])
    )
    ids[`${key}Product`] = product.id
    ids[key] = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, $2) returning id", [product.id, `COC-${key.toUpperCase()}`]))).id
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 8)", [product.id, ids.cash])
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 100, 3)", [ids[key]])
  }
  ids.combo = (await one(owner<{ id: string }>("insert into public.products (category_id, name, kind) values ($1, 'Promo 10x10', 'combo') returning id", [category.id]))).id
  ids.comboV = (await one(owner<{ id: string }>("select id from public.product_variants where product_id = $1", [ids.combo]))).id
  await owner("select public.save_combo_component($1, null, null, 10, array[$2]::uuid[])", [ids.combo, ids.apronProduct])
  await owner("select public.save_combo_component($1, null, null, 10, array[$2]::uuid[])", [ids.combo, ids.capProduct])
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 100)", [ids.combo, ids.cash])

  for (const code of ["embroidered_name", "pocket_logo"]) {
    ids[code] = (await one(owner<{ id: string }>("select id from public.customization_types where code = $1", [code]))).id
  }
  await owner("update public.customization_types set unit_price_usd = 4, min_quantity = 1 where code = 'embroidered_name'")
  await owner("update public.customization_types set unit_price_usd = 6, min_quantity = 1 where code = 'pocket_logo'")
})

describe("personalizar las piezas de un combo", () => {
  it("en una venta: cada pieza lleva lo suyo, la incluida no suma y la cobrada sí", async () => {
    const id = await sell([promo()])
    expect(await saved(id)).toEqual([
      { product: "Delantal", on_child: true, charged: false, line_total_usd: "0.00", names: "0" },
      { product: "Gorro", on_child: true, charged: true, line_total_usd: (await namesTotal()).toFixed(2), names: "10" },
    ])
    expect(await total(id)).toBe(100 + (await namesTotal()))
  })

  it("no va en el combo mismo ni en más piezas de las del componente", async () => {
    await expect(sell([promo({ customizations: [custom({ type: "embroidered_name", text: "Ana" })] })])).rejects.toThrow(/cada una de sus piezas/)
    await expect(sell([promo({}, [{ type: "pocket_logo", quantity: 11, logo: "logos/x.png", text: "X", charged: false }])])).rejects.toThrow(
      /piezas van de 1/
    )
  })

  it("en un pedido: igual, y la personalización incluida no se cobra", async () => {
    const id = await order([promo()])
    expect(await saved(id)).toMatchObject([
      { product: "Delantal", on_child: true, charged: false },
      { product: "Gorro", on_child: true, charged: true, names: "10" },
    ])
    expect(await total(id)).toBe(100 + (await namesTotal()))
  })

  it("en un presupuesto: va en cada pieza, y pasa igual al duplicarlo y al convertirlo en pedido", async () => {
    const payload = {
      customer: { name: "Escuela" },
      currencies: "usd",
      usd_price_method_id: ids.cash,
      items: [{ ...promo({}, [{ type: "pocket_logo", charged: false }], [{ type: "embroidered_name" }]) }],
    }
    const quote = (await one(owner<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [JSON.stringify(payload)]))).id
    const rows = await owner<{ kind: string; charged: boolean; line_total_usd: string }>(
      `select qi.kind, qc.charged, qc.line_total_usd from public.quote_item_customizations qc
       join public.quote_items qi on qi.id = qc.quote_item_id where qi.quote_id = $1 order by qc.charged`,
      [quote]
    )
    expect(rows.rows).toEqual([
      { kind: "component", charged: false, line_total_usd: "0.00" },
      { kind: "component", charged: true, line_total_usd: (await namesTotal()).toFixed(2) },
    ])
    const q = await one(owner<{ customization_total_usd: string; usd_total: string }>("select customization_total_usd, usd_total from public.quotes where id = $1", [quote]))
    expect(Number(q.customization_total_usd)).toBe(await namesTotal())

    // Duplicar o versionar copia la personalización de cada pieza.
    const copy = await one(
      db.query<{ p: { items: { components: { customizations: { charged: boolean }[] }[] }[] } }>("select public.quote_payload($1) as p", [quote])
    )
    expect(copy.p.items[0].components.map((c) => c.customizations.map((x) => x.charged))).toEqual([[false], [true]])

    // Al pedido: el logo y los nombres que el presupuesto no pide se completan al convertir.
    await owner("select public.send_quote($1)", [quote])
    await owner("select public.mark_quote($1, 'accepted')", [quote])
    const qcs = await owner<{ id: string; charged: boolean }>(
      "select qc.id, qc.charged from public.quote_item_customizations qc join public.quote_items qi on qi.id = qc.quote_item_id where qi.quote_id = $1",
      [quote]
    )
    const details = Object.fromEntries(
      qcs.rows.map((r) => [r.id, r.charged ? { names: NAMES } : { logo_path: "logos/escuela.png", text: "Logo escuela" }])
    )
    const sale = (
      await one(
        owner<{ id: string }>(
          "select public.convert_quote_to_order($1, $2, 'usd', 'produce_all', null, 'whatsapp', 'pickup', null, $3::jsonb) as id",
          [quote, ids.customer, JSON.stringify(details)]
        )
      )
    ).id
    expect(await saved(sale)).toMatchObject([
      { product: "Delantal", on_child: true, charged: false },
      { product: "Gorro", on_child: true, charged: true, names: "10" },
    ])
    expect(await total(sale)).toBe(Number(q.usd_total))
  })
})
