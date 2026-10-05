import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

type Component = { variant: string; quantity: number; source?: "stock" | "made_to_order" }
type Line =
  | { variant: string; quantity: number; source?: "stock" | "made_to_order" }
  | { combo: string; quantity: number; components: Component[] }

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const toItem = (line: Line) =>
  "combo" in line
    ? {
        variant_id: ids[line.combo],
        quantity: line.quantity,
        components: line.components.map((c) => ({ variant_id: ids[c.variant], quantity: c.quantity, source: c.source ?? "stock" })),
      }
    : { variant_id: ids[line.variant], quantity: line.quantity, source: line.source ?? "stock" }

const sell = (as: ReturnType<typeof asUser>, lines: Line[], discount?: { type: "percent" | "amount"; value: number }) =>
  as<{ id: string }>(
    `select public.create_sale(
       p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup', p_items => $2::jsonb,
       p_discount_type => $3::public.discount_type, p_discount_value => $4, p_discount_reason => $5
     ) as id`,
    [ids.cash, JSON.stringify(lines.map(toItem)), discount?.type ?? null, discount?.value ?? null, discount ? "Prueba" : null]
  ).then((r) => r.rows[0].id)

const stock = (variant: string) =>
  owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]]).then((r) =>
    Number(r.rows[0]?.quantity ?? 0)
  )

const sale = (id: string) =>
  one(
    owner<{ subtotal_usd: string; volume_discount_percent: string; volume_discount_usd: string; discount_usd: string; total_usd: string }>(
      "select * from public.sales where id = $1",
      [id]
    )
  )

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
      owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [
        account.id,
      ])
    )
  ).id
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Uniformes', 'UNI') returning id"))
  const size = await one(owner<{ id: string }>("select id from public.sizes where code = 'M'"))
  const sizeL = await one(owner<{ id: string }>("select id from public.sizes where code = 'L'"))

  // Componentes: filipina (tallas M y L), pantalón (M) y delantal por encargo.
  const product = async (name: string, fulfillment = "stock", labor = 0) =>
    (
      await one(
        owner<{ id: string }>(
          "insert into public.products (category_id, name, fulfillment_type, labor_cost_usdt) values ($1, $2, $3::public.fulfillment_type, $4) returning id",
          [category.id, name, fulfillment, labor]
        )
      )
    ).id
  const variant = async (productId: string, sku: string, sizeId: string | null) =>
    (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku, size_id) values ($1, $2, $3) returning id", [productId, sku, sizeId]))).id

  ids.filipina = await product("Filipina", "stock", 3)
  ids.pantalon = await product("Pantalón", "stock", 2)
  ids.delantal = await product("Delantal", "made_to_order")
  ids.filM = await variant(ids.filipina, "UNI-FIL-M", size.id)
  ids.filL = await variant(ids.filipina, "UNI-FIL-L", sizeL.id)
  ids.panM = await variant(ids.pantalon, "UNI-PAN-M", size.id)
  ids.delU = await variant(ids.delantal, "UNI-DEL", null)
  for (const [v, cost] of [
    ["filM", 10],
    ["filL", 12],
    ["panM", 8],
  ] as const) {
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 20, $2)", [ids[v], cost])
  }
  for (const [p, price] of [
    ["filipina", 25],
    ["pantalon", 20],
    ["delantal", 15],
  ] as const) {
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, $3)", [ids[p], ids.cash, price])
  }
})

describe("combos: definición", () => {
  it("un combo nace con una sola variante, sin stock ni receta", async () => {
    const category = await one(owner<{ id: string }>("select id from public.product_categories where code = 'UNI'"))
    ids.combo = (
      await one(owner<{ id: string }>("insert into public.products (category_id, name, kind) values ($1, 'Combo Escuela', 'combo') returning id", [category.id]))
    ).id
    const variants = await owner<{ id: string; sku: string }>("select id, sku from public.product_variants where product_id = $1", [ids.combo])
    expect(variants.rows).toHaveLength(1)
    expect(variants.rows[0].sku).toMatch(/^CMB-[A-Z0-9]{8}$/)
    ids.comboV = variants.rows[0].id

    await expect(owner("insert into public.product_variants (product_id, sku) values ($1, 'CMB-OTRA')", [ids.combo])).rejects.toThrow(/una sola variante/)
    await expect(
      owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 5, 1)", [ids.comboV])
    ).rejects.toThrow(/no lleva stock/)
    // El tipo no se cambia: lo impiden los permisos de columna (y un trigger como respaldo).
    await expect(owner("update public.products set kind = 'finished_good' where id = $1", [ids.combo])).rejects.toThrow(/permission denied|no se cambia/)
  })

  it("solo owner y admin definen componentes, y deben ser productos terminados", async () => {
    await expect(
      staff("insert into public.combo_components (combo_product_id, component_product_id) values ($1, $2)", [ids.combo, ids.filipina])
    ).rejects.toThrow()
    await expect(
      owner("insert into public.combo_components (combo_product_id, component_product_id) values ($1, $2)", [ids.filipina, ids.pantalon])
    ).rejects.toThrow(/Solo un combo/)
    await expect(
      owner("insert into public.combo_components (combo_product_id, component_product_id) values ($1, $1)", [ids.combo])
    ).rejects.toThrow()

    await owner(
      `insert into public.combo_components (combo_product_id, component_product_id, quantity, sort_order) values
         ($1, $2, 1, 1), ($1, $3, 1, 2), ($1, $4, 1, 3)`,
      [ids.combo, ids.filipina, ids.pantalon, ids.delantal]
    )
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 50)", [ids.combo, ids.cash])
    const seen = await staff("select * from public.combo_components where combo_product_id = $1", [ids.combo])
    expect(seen.rows).toHaveLength(3)
  })
})

describe("combos: venta", () => {
  it("el combo lleva el precio y cada componente descuenta su stock o va a producción", async () => {
    const before = { filM: await stock("filM"), filL: await stock("filL"), panM: await stock("panM") }
    // Dos combos: una filipina M y una L, dos pantalones M y dos delantales por encargo.
    const id = await sell(staff, [
      {
        combo: "comboV",
        quantity: 2,
        components: [
          { variant: "filM", quantity: 1 },
          { variant: "filL", quantity: 1 },
          { variant: "panM", quantity: 2 },
          { variant: "delU", quantity: 2, source: "made_to_order" },
        ],
      },
    ])

    const s = await sale(id)
    expect(Number(s.subtotal_usd)).toBe(100)
    expect(Number(s.total_usd)).toBe(100)

    const items = await owner<{ source: string; parent_item_id: string | null; unit_price_usd: string; line_total_usd: string; quantity: string }>(
      "select source, parent_item_id, unit_price_usd, line_total_usd, quantity from public.sale_items where sale_id = $1 order by parent_item_id nulls first",
      [id]
    )
    expect(items.rows).toHaveLength(5)
    const [parent, ...children] = items.rows
    expect(parent).toMatchObject({ source: "combo", parent_item_id: null, unit_price_usd: "50.00", line_total_usd: "100.00" })
    for (const child of children) {
      expect(child.parent_item_id).not.toBeNull()
      expect(Number(child.unit_price_usd)).toBe(0)
    }

    expect(await stock("filM")).toBe(before.filM - 1)
    expect(await stock("filL")).toBe(before.filL - 1)
    expect(await stock("panM")).toBe(before.panM - 2)

    // La línea del combo no tiene estado; los componentes sí.
    const statuses = await owner<{ source: string; status: string | null }>(
      `select i.source, cs.status from public.sale_items i
       left join public.sale_item_current_status cs on cs.sale_item_id = i.id where i.sale_id = $1`,
      [id]
    )
    expect(statuses.rows.find((r) => r.source === "combo")?.status).toBeNull()
    expect(statuses.rows.filter((r) => r.source === "made_to_order").every((r) => r.status === "to_produce")).toBe(true)

    const parentId = (await one(owner<{ id: string }>("select id from public.sale_items where sale_id = $1 and source = 'combo'", [id]))).id
    await expect(owner("select public.set_sale_item_status($1, 'ready')", [parentId])).rejects.toThrow(/cada componente/)
  })

  it("rechaza componentes que no suman lo que pide el combo o que no son del combo", async () => {
    await expect(
      sell(owner, [{ combo: "comboV", quantity: 1, components: [{ variant: "filM", quantity: 1 }, { variant: "panM", quantity: 1 }] }])
    ).rejects.toThrow(/lleva 1 de "Delantal": elegiste 0/)
    await expect(
      sell(owner, [
        {
          combo: "comboV",
          quantity: 1,
          components: [
            { variant: "filM", quantity: 2 },
            { variant: "panM", quantity: 1 },
            { variant: "delU", quantity: 1, source: "made_to_order" },
          ],
        },
      ])
    ).rejects.toThrow(/lleva 1 de "Filipina": elegiste 2/)
    await expect(sell(owner, [{ combo: "comboV", quantity: 1, components: [] }])).rejects.toThrow(/lleva 1/)
    // Un producto suelto no puede venderse como combo, ni el combo sin componentes.
    await expect(owner(
      `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup',
         p_items => $2::jsonb)`,
      [ids.cash, JSON.stringify([{ variant_id: ids.comboV, quantity: 1 }])]
    )).rejects.toThrow(/Elige la talla y el color/)
  })

  it("anular devuelve el stock de los componentes", async () => {
    const before = await stock("panM")
    const id = await sell(owner, [
      {
        combo: "comboV",
        quantity: 1,
        components: [
          { variant: "filM", quantity: 1 },
          { variant: "panM", quantity: 1 },
          { variant: "delU", quantity: 1, source: "made_to_order" },
        ],
      },
    ])
    expect(await stock("panM")).toBe(before - 1)
    await owner("select public.void_sale($1, 'Prueba')", [id])
    expect(await stock("panM")).toBe(before)
  })
})

describe("descuento al mayor", () => {
  it("solo owner y admin definen los tramos", async () => {
    await expect(staff("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('products', 10, 5)")).rejects.toThrow()
    await owner("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('products', 10, 5), ('products', 20, 10)")
    await expect(owner("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('products', 1, 5)")).rejects.toThrow()
  })

  it("se aplica solo según las piezas, y el descuento manual va sobre lo que queda", async () => {
    // 9 piezas: sin descuento.
    const small = await sale(await sell(owner, [{ variant: "filM", quantity: 9 }]))
    expect(Number(small.volume_discount_usd)).toBe(0)

    // 10 piezas: 5%.
    const mid = await sale(await sell(owner, [{ variant: "filM", quantity: 10 }]))
    expect(Number(mid.volume_discount_percent)).toBe(5)
    expect(Number(mid.volume_discount_usd)).toBe(12.5)
    expect(Number(mid.total_usd)).toBe(237.5)

    // Combos cuentan por componentes: 4 combos = 12 piezas → 5%. Más 10% manual sobre lo que queda.
    const combos = await sale(
      await sell(
        owner,
        [
          {
            combo: "comboV",
            quantity: 4,
            components: [
              { variant: "filL", quantity: 4 },
              { variant: "panM", quantity: 4 },
              { variant: "delU", quantity: 4, source: "made_to_order" },
            ],
          },
        ],
        { type: "percent", value: 10 }
      )
    )
    expect(Number(combos.subtotal_usd)).toBe(200)
    expect(Number(combos.volume_discount_usd)).toBe(10)
    expect(Number(combos.discount_usd)).toBe(19)
    expect(Number(combos.total_usd)).toBe(171)
  })

  it("el descuento al mayor no cuenta para el límite de staff", async () => {
    // 20 piezas: 10% al mayor; staff suma 10% manual (su límite) y pasa.
    const id = await sell(staff, [{ variant: "panM", quantity: 10 }, { variant: "filL", quantity: 10 }], {
      type: "percent",
      value: 10,
    })
    const s = await sale(id)
    expect(Number(s.volume_discount_percent)).toBe(10)
    expect(Number(s.discount_usd)).toBeGreaterThan(0)
  })
})

describe("personalización", () => {
  it("trae los cuatro tipos; los logos sin precio hasta confirmarlo", async () => {
    const types = await staff<{ code: string; unit_price_usd: string | null; min_quantity: number }>(
      "select code, unit_price_usd, min_quantity from public.customization_types order by sort_order"
    )
    expect(types.rows.map((t) => t.code)).toEqual(["embroidered_name", "pocket_logo", "printed_logo", "chest_logo"])
    expect(types.rows[0]).toMatchObject({ unit_price_usd: "4.00", min_quantity: 1 })
    expect(types.rows.slice(1).every((t) => t.unit_price_usd === null && t.min_quantity === 6)).toBe(true)
  })

  it("solo owner y admin cambian precios; el código no cambia", async () => {
    await staff("update public.customization_types set unit_price_usd = 1 where code = 'embroidered_name'")
    expect((await one(owner<{ unit_price_usd: string }>("select unit_price_usd from public.customization_types where code = 'embroidered_name'"))).unit_price_usd).toBe("4.00")
    await owner("update public.customization_types set unit_price_usd = 7 where code = 'pocket_logo'")
    await expect(owner("update public.customization_types set code = 'otro' where code = 'pocket_logo'")).rejects.toThrow()
  })
})

describe("márgenes con combos", () => {
  it("el ingreso del combo se reparte entre sus componentes", async () => {
    const rows = await owner<{ product_name: string; revenue_usd: string }>(
      "select product_name, revenue_usd from public.product_sales_margin(public.caracas_today(), public.caracas_today())"
    )
    const names = rows.rows.map((r) => r.product_name)
    expect(names).not.toContain("Combo Escuela")
    expect(names).toEqual(expect.arrayContaining(["Filipina", "Pantalón", "Delantal"]))
  })

  it("el margen de catálogo del combo suma el costo de sus componentes", async () => {
    // El delantal (por encargo, sin receta) no tiene costo: el combo queda sin costo.
    const rows = await owner<{ product_name: string; material_cost_usdt: string | null; cost_source: string | null }>(
      "select product_name, material_cost_usdt, cost_source from public.product_margins() where product_id = $1",
      [ids.combo]
    )
    expect(rows.rows[0]).toMatchObject({ material_cost_usdt: null, cost_source: null })

    await owner("delete from public.combo_components where combo_product_id = $1 and component_product_id = $2", [ids.combo, ids.delantal])
    const after = await one(
      owner<{ material_cost_usdt: string; labor_cost_usdt: string; cost_source: string }>(
        "select material_cost_usdt, labor_cost_usdt, cost_source from public.product_margins() where product_id = $1",
        [ids.combo]
      )
    )
    // Filipina: promedio (10 + 12) / 2 = 11; pantalón 8. Mano de obra 3 + 2.
    expect(Number(after.material_cost_usdt)).toBe(19)
    expect(Number(after.labor_cost_usdt)).toBe(5)
    expect(after.cost_source).toBe("components")
  })
})
