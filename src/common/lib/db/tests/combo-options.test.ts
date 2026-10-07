import { beforeAll, describe, expect, it } from "vitest"

import { applyMigrations, asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

type Piece = { variant: string; quantity: number }
const comboItem = (quantity: number, pieces: Piece[]) => ({
  variant_id: ids.comboV,
  quantity,
  components: pieces.map((p) => ({ variant_id: ids[p.variant], quantity: p.quantity, source: "stock" })),
})

const sellCombo = (as: ReturnType<typeof asUser>, quantity: number, pieces: Piece[]) =>
  one(
    as<{ id: string }>(
      `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup', p_items => $2::jsonb) as id`,
      [ids.cash, JSON.stringify([comboItem(quantity, pieces)])]
    )
  ).then((r) => r.id)

const slot = (products: string[], quantity = 1, label: string | null = null, id: string | null = null) =>
  one(
    owner<{ id: string }>("select public.save_combo_component($1, $2, $3, $4, $5::uuid[]) as id", [
      ids.combo,
      id,
      label,
      quantity,
      products.map((p) => ids[p]),
    ])
  ).then((r) => r.id)

beforeAll(async () => {
  // Hasta antes de esta migración: un combo armado "a la antigua" para ver cómo se convierte.
  db = await createTestDb({ until: "20261024000000" })
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
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Uniformes', 'UNI') returning id"))
  ids.sizeM = (await one(owner<{ id: string }>("select id from public.sizes where code = 'M'"))).id
  ids.sizeXl = (await one(owner<{ id: string }>("insert into public.sizes (name, code, sort_order) values ('3XL', '3XL', 7) returning id"))).id

  // Filipinas manga corta (botón, cierre) y pantalones (recto, jogger), en M y 3XL.
  const products = [
    ["boton", "Filipina manga corta botón", 10, 3],
    ["cierre", "Filipina manga corta cierre", 14, 3],
    ["recto", "Pantalón recto", 8, 2],
    ["jogger", "Pantalón jogger", 9, 2],
  ] as const
  for (const [key, name, cost, labor] of products) {
    ids[key] = (
      await one(
        owner<{ id: string }>(
          "insert into public.products (category_id, name, fulfillment_type, labor_cost_usdt) values ($1, $2, 'stock', $3) returning id",
          [category.id, name, labor]
        )
      )
    ).id
    for (const [size, sizeId] of [
      ["M", ids.sizeM],
      ["3XL", ids.sizeXl],
    ]) {
      const variant = `${key}${size}`
      ids[variant] = (
        await one(
          owner<{ id: string }>("insert into public.product_variants (product_id, size_id, sku) values ($1, $2, $3) returning id", [
            ids[key],
            sizeId,
            `UNI-${key.toUpperCase()}-${size}`,
          ])
        )
      ).id
      await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 20, $2)", [
        ids[variant],
        cost,
      ])
    }
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 30), ($1, $3, 30)", [ids[key], ids.cash, ids.mobile])
  }
  // La 3XL de la filipina de botón cuesta $3 más; la del jogger, $2.
  await owner("insert into public.size_surcharges (size_id, product_id, amount_usd) values ($1, $2, 3), ($1, $3, 2)", [ids.sizeXl, ids.boton, ids.jogger])

  ids.combo = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, kind) values ($1, 'Combo chef', 'combo') returning id", [category.id]))
  ).id
  ids.comboV = (await one(owner<{ id: string }>("select id from public.product_variants where product_id = $1", [ids.combo]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 50), ($1, $3, 50)", [ids.combo, ids.cash, ids.mobile])
  // Antes: un componente = un producto.
  await owner(
    "insert into public.combo_components (combo_product_id, component_product_id, quantity, sort_order) values ($1, $2, 1, 1), ($1, $3, 1, 2)",
    [ids.combo, ids.boton, ids.recto]
  )

  await applyMigrations(db, { from: "20261024000000" })
})

describe("combos con opciones: definición", () => {
  it("los componentes que ya existían quedan como componentes con una sola opción", async () => {
    const rows = await owner<{ quantity: number; label: string | null; products: string[] }>(
      `select cc.quantity, cc.label, array_agg(p.name) as products
       from public.combo_components cc
       join public.combo_component_options o on o.component_id = cc.id
       join public.products p on p.id = o.product_id
       where cc.combo_product_id = $1 group by cc.id order by cc.sort_order`,
      [ids.combo]
    )
    expect(rows.rows).toEqual([
      { quantity: 1, label: null, products: ["Filipina manga corta botón"] },
      { quantity: 1, label: null, products: ["Pantalón recto"] },
    ])
  })

  it("un componente acepta varios productos, con nombre; un producto va en un solo componente", async () => {
    const [shirt, pants] = (
      await owner<{ id: string; product_id: string }>(
        `select cc.id, o.product_id from public.combo_components cc
         join public.combo_component_options o on o.component_id = cc.id
         where cc.combo_product_id = $1 order by cc.sort_order`,
        [ids.combo]
      )
    ).rows
    ids.shirtSlot = shirt.id
    ids.pantsSlot = pants.id
    await slot(["boton", "cierre"], 1, "Filipina manga corta", ids.shirtSlot)
    await slot(["recto", "jogger"], 1, "Pantalón", ids.pantsSlot)

    const slots = await staff<{ name: string; quantity: number }>("select name, quantity from public.combo_slots($1)", [ids.combo]).catch(() => null)
    // combo_slots es interno: nadie la llama directo.
    expect(slots).toBeNull()
    const options = await staff<{ product_id: string }>("select product_id from public.combo_component_options where combo_product_id = $1", [ids.combo])
    expect(options.rows).toHaveLength(4)

    await expect(slot(["jogger"], 1, "Otro pantalón")).rejects.toThrow(/ya está en otro componente/)
    await expect(slot([], 1)).rejects.toThrow(/al menos un producto/)
    await expect(staff("insert into public.combo_component_options (component_id, product_id) values ($1, $2)", [ids.shirtSlot, ids.cierre])).rejects.toThrow()
  })
})

describe("combos con opciones: venta", () => {
  it("se vende con cualquier producto de cada componente, y se pueden mezclar", async () => {
    const before = { boton: await stockOf("botonM"), cierre: await stockOf("cierreM") }
    const id = await sellCombo(staff, 2, [
      { variant: "botonM", quantity: 1 },
      { variant: "cierreM", quantity: 1 },
      { variant: "joggerM", quantity: 2 },
    ])
    const sale = await one(owner<{ subtotal_usd: string; total_usd: string }>("select subtotal_usd, total_usd from public.sales where id = $1", [id]))
    expect(sale).toEqual({ subtotal_usd: "100.00", total_usd: "100.00" })
    expect(await stockOf("botonM")).toBe(before.boton - 1)
    expect(await stockOf("cierreM")).toBe(before.cierre - 1)
  })

  it("cada pieza suma el recargo de su talla encima del precio del combo", async () => {
    // Filipina de botón 3XL (+3) y jogger 3XL (+2): 50 + 3 + 2.
    const id = await sellCombo(staff, 1, [
      { variant: "boton3XL", quantity: 1 },
      { variant: "jogger3XL", quantity: 1 },
    ])
    const sale = await one(owner<{ subtotal_usd: string; total_usd: string }>("select subtotal_usd, total_usd from public.sales where id = $1", [id]))
    expect(sale).toEqual({ subtotal_usd: "55.00", total_usd: "55.00" })
    const lines = await owner<{ sku: string; unit_price_usd: string; line_total_usd: string }>(
      `select v.sku, i.unit_price_usd, i.line_total_usd from public.sale_items i
       join public.product_variants v on v.id = i.variant_id where i.sale_id = $1 order by i.parent_item_id nulls first, v.sku`,
      [id]
    )
    expect(lines.rows).toEqual([
      { sku: expect.stringMatching(/^CMB-/), unit_price_usd: "50.00", line_total_usd: "50.00" },
      { sku: "UNI-BOTON-3XL", unit_price_usd: "3.00", line_total_usd: "3.00" },
      { sku: "UNI-JOGGER-3XL", unit_price_usd: "2.00", line_total_usd: "2.00" },
    ])

    // Margen por producto vendido: la filipina se lleva su recargo.
    const margin = await owner<{ product_name: string; revenue_usd: string }>(
      "select product_name, revenue_usd from public.product_sales_margin(public.caracas_today(), public.caracas_today()) where product_name like 'Filipina%botón'"
    )
    expect(Number(margin.rows[0].revenue_usd)).toBeGreaterThan(0)
  })

  it("rechaza piezas de menos por componente o productos que no son del combo", async () => {
    await expect(sellCombo(owner, 1, [{ variant: "botonM", quantity: 1 }])).rejects.toThrow(/lleva 1 de "Pantalón": elegiste 0/)
    await expect(
      sellCombo(owner, 1, [
        { variant: "botonM", quantity: 1 },
        { variant: "cierreM", quantity: 1 },
        { variant: "rectoM", quantity: 1 },
      ])
    ).rejects.toThrow(/lleva 1 de "Filipina manga corta": elegiste 2/)

    const other = await one(owner<{ id: string }>("insert into public.products (category_id, name) select category_id, 'Gorro' from public.products where id = $1 returning id", [ids.boton]))
    const gorro = await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'UNI-GOR') returning id", [other.id]))
    ids.gorro = gorro.id
    await expect(
      sellCombo(owner, 1, [
        { variant: "botonM", quantity: 1 },
        { variant: "gorro", quantity: 1 },
      ])
    ).rejects.toThrow(/"Gorro" no es parte del combo/)
  })
})

describe("combos con opciones: presupuesto y pedido", () => {
  it("el presupuesto suma el recargo de cada pieza en ambas listas y el pedido cobra lo mismo", async () => {
    const payload = {
      customer: { name: "Restaurante Litoral" },
      currencies: "both",
      usd_price_method_id: ids.cash,
      ves_price_method_id: ids.mobile,
      items: [comboItem(2, [{ variant: "boton3XL", quantity: 2 }, { variant: "rectoM", quantity: 1 }, { variant: "jogger3XL", quantity: 1 }])],
    }
    const quoteId = (await one(owner<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [JSON.stringify(payload)]))).id
    const quote = await one(owner<{ usd_total: string; ves_total: string }>("select usd_total, ves_total from public.quotes where id = $1", [quoteId]))
    // 2 combos (100) + 2 filipinas 3XL (6) + 1 jogger 3XL (2).
    expect(quote).toEqual({ usd_total: "108.00", ves_total: "108.00" })
    const pieces = await owner<{ sku: string; usd_unit_price: string; usd_line_total: string }>(
      `select sku, usd_unit_price, usd_line_total from public.quote_items where quote_id = $1 and kind = 'component' order by sku`,
      [quoteId]
    )
    expect(pieces.rows).toEqual([
      { sku: "UNI-BOTON-3XL", usd_unit_price: "3.00", usd_line_total: "6.00" },
      { sku: "UNI-JOGGER-3XL", usd_unit_price: "2.00", usd_line_total: "2.00" },
      { sku: "UNI-RECTO-M", usd_unit_price: "0.00", usd_line_total: "0.00" },
    ])

    await owner("select public.send_quote($1)", [quoteId])
    await owner("select public.mark_quote($1, 'accepted')", [quoteId])
    const customer = await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Litoral', '+584141234567') returning id"))
    const saleId = (
      await one(
        owner<{ id: string }>(
          "select public.convert_quote_to_order($1, $2, 'usd', 'reserve_and_produce', null, 'whatsapp', 'pickup', null, '{}'::jsonb) as id",
          [quoteId, customer.id]
        )
      )
    ).id
    const sale = await one(owner<{ total_usd: string }>("select total_usd from public.sales where id = $1", [saleId]))
    expect(sale.total_usd).toBe("108.00")
  })
})

describe("combos con opciones: margen de catálogo", () => {
  it("típico por lo que más se vende y rango del producto más barato al más caro", async () => {
    const row = await one(
      owner<{ material_cost_usdt: string; labor_cost_usdt: string; cost_min_usdt: string; cost_max_usdt: string; cost_source: string }>(
        `select material_cost_usdt, labor_cost_usdt, cost_min_usdt, cost_max_usdt, cost_source
         from public.product_margins() where product_id = $1 and payment_method_id = $2`,
        [ids.combo, ids.cash]
      )
    )
    // Vendido en filipinas: botón 1 M + 1 3XL (a 10), cierre 1 M (a 14) → (10 + 10 + 14) / 3 = 11,333333.
    // Pantalones: jogger 2 M + 1 3XL (a 9) → 9. Pedido del presupuesto: filipina botón 3XL × 2, recto 1, jogger 1
    // también cuentan (son ventas): botón 4 a 10, cierre 1 a 14 → 10,8; recto 1 a 8, jogger 4 a 9 → 8,8.
    expect(Number(row.material_cost_usdt)).toBe(19.6)
    expect(Number(row.labor_cost_usdt)).toBe(5)
    expect(row.cost_source).toBe("sales_mix")
    // Rango: filipina 10 + 3 a 14 + 3; pantalón 8 + 2 a 9 + 2.
    expect(Number(row.cost_min_usdt)).toBe(23)
    expect(Number(row.cost_max_usdt)).toBe(28)
  })

  it("staff no ve márgenes", async () => {
    expect((await staff("select * from public.product_margins()")).rows).toHaveLength(0)
  })
})

async function stockOf(variant: string) {
  const row = await one(owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]]))
  return Number(row?.quantity ?? 0)
}
