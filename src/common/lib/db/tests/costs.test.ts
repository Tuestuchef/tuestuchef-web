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

const stock = (variant: string) =>
  owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]]).then((r) =>
    Number(r.rows[0]?.quantity ?? 0)
  )
const avg = (variant: string) =>
  owner<{ unit_cost_usdt: string | null }>("select unit_cost_usdt from public.product_variants where id = $1", [ids[variant]]).then(
    (r) => (r.rows[0].unit_cost_usdt === null ? null : Number(r.rows[0].unit_cost_usdt))
  )

// Compra de contado en efectivo (USD) a 1 USD = 1 USDT.
const buy = (variant: string, quantity: number, cost: number) =>
  owner(
    `select public.create_purchase(p_supplier_id => $1, p_items => $2::jsonb, p_payments => $3::jsonb)`,
    [
      ids.supplier,
      JSON.stringify([{ line_type: "inventory", variant_id: ids[variant], quantity, unit_cost_usd: cost, category_id: ids.cost }]),
      JSON.stringify([{ account_id: ids.cash, amount: Math.round(quantity * cost * 100) / 100 }]),
    ]
  )

const produce = (as: ReturnType<typeof asUser>, variant: string, quantity: number, cost?: number) =>
  as<{ id: string }>("select public.register_production($1, $2, $3) as id", [ids[variant], quantity, cost ?? null]).then(
    (r) => r.rows[0].id
  )

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  ids.cash = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Efectivo', 'USD', 'cash') returning id"))).id
  ids.bank = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id"))).id
  ids.cost = (await one(owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Materiales', 'cost') returning id"))).id
  const income = (await one(owner<{ id: string }>("select id from public.movement_categories where is_system and type = 'sales'"))).id
  await owner("insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ($1, 'income', $2, 100000)", [ids.cash, income])
  ids.supplier = (await one(owner<{ id: string }>("insert into public.suppliers (name) values ('Textiles') returning id"))).id

  const colors = await owner<{ id: string; code: string }>("insert into public.colors (name, code) values ('Negro', 'NEG'), ('Blanco', 'BLA') returning id, code")
  for (const c of colors.rows) ids[c.code] = c.id
  const sizes = await owner<{ id: string; code: string }>("select id, code from public.sizes where code in ('M', 'XL')")
  for (const s of sizes.rows) ids[s.code] = s.id

  const rawCat = (await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Insumos', 'INS') returning id"))).id
  const filCat = (await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))).id

  // Tela por metro, en negro (sin blanco); botones por unidad.
  ids.fabric = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, kind, unit, fulfillment_type) values ($1, 'Tela antifluido', 'raw_material', 'meter', 'stock') returning id", [rawCat]))
  ).id
  ids.fabricBlack = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, sku) values ($1, $2, 'TELA-NEG') returning id", [ids.fabric, ids.NEG]))).id
  const buttons = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, kind, unit, fulfillment_type) values ($1, 'Botones', 'raw_material', 'unit', 'stock') returning id", [rawCat]))
  ).id
  ids.buttons = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'BOT-1') returning id", [buttons]))).id

  // Filipina (stock) con variantes negro M, negro XL y blanco M; gorro por encargo.
  ids.filipina = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type, labor_cost_usdt) values ($1, 'Filipina', 'stock', 3) returning id", [filCat]))
  ).id
  ids.filBlackM = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, size_id, sku) values ($1, $2, $3, 'FIL-NEG-M') returning id", [ids.filipina, ids.NEG, ids.M]))).id
  ids.filBlackXL = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, size_id, sku) values ($1, $2, $3, 'FIL-NEG-XL') returning id", [ids.filipina, ids.NEG, ids.XL]))).id
  ids.filWhiteM = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, size_id, sku) values ($1, $2, $3, 'FIL-BLA-M') returning id", [ids.filipina, ids.BLA, ids.M]))).id
  ids.gorro = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Gorro', 'made_to_order') returning id", [filCat]))
  ).id
  ids.gorroBlack = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, sku) values ($1, $2, 'GOR-NEG') returning id", [ids.gorro, ids.NEG]))).id

  // Recetas: filipina = 1,5 m de tela del color de la prenda (2 m en XL) + 6 botones; gorro = 0,5 m de tela.
  await owner(
    `insert into public.product_recipe_lines (product_id, raw_product_id, size_id, quantity) values
       ($1, $2, null, 1.5), ($1, $2, $3, 2)`,
    [ids.filipina, ids.fabric, ids.XL]
  )
  await owner("insert into public.product_recipe_lines (product_id, raw_variant_id, quantity) values ($1, $2, 6)", [ids.filipina, ids.buttons])
  await owner("insert into public.product_recipe_lines (product_id, raw_product_id, quantity) values ($1, $2, 0.5)", [ids.gorro, ids.fabric])

  // Precio en efectivo para el margen y para vender el gorro.
  ids.cashMethod = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [ids.cash]))
  ).id
  ids.mobileMethod = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'USD', 'bcv_usd') returning id", [ids.bank]))
  ).id
  await owner(
    `insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $3, 30), ($1, $4, 30), ($2, $3, 12)`,
    [ids.filipina, ids.gorro, ids.cashMethod, ids.mobileMethod]
  )
})

describe("costo promedio ponderado", () => {
  it("arranca con el costo actual y promedia cada entrada con costo", async () => {
    await buy("fabricBlack", 10, 4) // 10 m a 4
    expect(await avg("fabricBlack")).toBe(4)
    await buy("fabricBlack", 10, 6) // 20 m: (10×4 + 10×6) / 20 = 5
    expect(await avg("fabricBlack")).toBe(5)
  })

  it("las salidas no cambian el promedio", async () => {
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, note) values ($1, 'adjustment', -2, 'Merma')", [ids.fabricBlack])
    expect(await avg("fabricBlack")).toBe(5)
  })

  it("anular una compra quita su costo del promedio", async () => {
    const before = await avg("fabricBlack") // 5 con 18 m
    const purchase = (await buy("fabricBlack", 2, 14)).rows[0] as { create_purchase: string } // 20 m: (18×5 + 2×14)/20 = 5,9
    expect(await avg("fabricBlack")).toBe(5.9)
    await owner("select public.void_purchase($1, 'Error')", [purchase.create_purchase])
    expect(await avg("fabricBlack")).toBe(before)
  })
})

describe("recetas: permisos y validación", () => {
  it("staff ve las recetas pero no las edita", async () => {
    expect((await staff("select * from public.product_recipe_lines")).rows.length).toBeGreaterThan(0)
    await expect(
      staff("insert into public.product_recipe_lines (product_id, raw_variant_id, quantity) values ($1, $2, 1)", [ids.gorro, ids.buttons])
    ).rejects.toThrow(/row-level security/)
  })

  it("una receta es de un producto terminado y sus materiales son materia prima", async () => {
    await expect(
      owner("insert into public.product_recipe_lines (product_id, raw_variant_id, quantity) values ($1, $2, 1)", [ids.fabric, ids.buttons])
    ).rejects.toThrow(/productos terminados/)
    await expect(
      owner("insert into public.product_recipe_lines (product_id, raw_variant_id, quantity) values ($1, $2, 1)", [ids.gorro, ids.filBlackM])
    ).rejects.toThrow(/deben ser materia prima/)
  })
})

describe("producción", () => {
  it("consume la receta (tela del color de la prenda) y suma las prendas con el costo de los materiales", async () => {
    await buy("buttons", 100, 0.1)
    const fabricBefore = await stock("fabricBlack")
    const buttonsBefore = await stock("buttons")
    const fabricCost = (await avg("fabricBlack"))!

    await produce(staff, "filBlackM", 2)

    expect(await stock("filBlackM")).toBe(2)
    expect(await stock("fabricBlack")).toBeCloseTo(fabricBefore - 3, 6) // 2 × 1,5 m
    expect(await stock("buttons")).toBe(buttonsBefore - 12) // 2 × 6
    // Costo por prenda = 1,5 m × costo tela + 6 × 0,10.
    expect(await avg("filBlackM")).toBeCloseTo(1.5 * fabricCost + 0.6, 6)
  })

  it("usa la cantidad de la talla cuando existe", async () => {
    const before = await stock("fabricBlack")
    await produce(owner, "filBlackXL", 1)
    expect(await stock("fabricBlack")).toBeCloseTo(before - 2, 6)
  })

  it("se bloquea con un mensaje claro si no existe el material del color de la prenda", async () => {
    await expect(produce(owner, "filWhiteM", 1)).rejects.toThrow(/No hay "Tela antifluido" en color Blanco/)
    expect(await stock("filWhiteM")).toBe(0)
  })

  it("se bloquea si no alcanza la materia prima, sin dejar nada a medias", async () => {
    const before = await stock("buttons")
    await expect(produce(owner, "filBlackM", 1000)).rejects.toThrow(/Stock insuficiente/)
    expect(await stock("buttons")).toBe(before)
  })

  it("producción y consumo solo desde register_production", async () => {
    await expect(
      owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'production', 1, 1)", [ids.filBlackM])
    ).rejects.toThrow(/Stock → Producción/)
    await expect(
      owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'consumption', -1, 1)", [ids.fabricBlack])
    ).rejects.toThrow(/Stock → Producción/)
  })

  it("la materia prima y los encargos no se producen para stock", async () => {
    await expect(produce(owner, "fabricBlack", 1, 1)).rejects.toThrow(/no se produce/)
    await expect(produce(owner, "gorroBlack", 1)).rejects.toThrow(/por encargo/)
  })

  it("las corridas de producción no se editan", async () => {
    await expect(db.query("update public.production_runs set quantity = 99")).rejects.toThrow(/no se editan/)
  })
})

describe("encargos", () => {
  const sellGorro = () =>
    staff<{ id: string }>(
      `select public.create_sale(p_channel => 'whatsapp', p_price_method_id => $1, p_delivery_method => 'pickup',
         p_items => $2::jsonb) as id`,
      [ids.cashMethod, JSON.stringify([{ variant_id: ids.gorroBlack, quantity: 4, source: "made_to_order" }])]
    ).then(async (r) => (await one(owner<{ id: string }>("select id from public.sale_items where sale_id = $1", [r.rows[0].id]))).id)

  it("al marcar el encargo como listo consume su receta una sola vez, sin sumar stock", async () => {
    const item = await sellGorro()
    const before = await stock("fabricBlack")

    await staff("select public.set_sale_item_status($1, 'in_production')", [item])
    expect(await stock("fabricBlack")).toBe(before)
    await staff("select public.set_sale_item_status($1, 'ready')", [item])
    expect(await stock("fabricBlack")).toBeCloseTo(before - 2, 6) // 4 × 0,5 m
    await staff("select public.set_sale_item_status($1, 'delivered')", [item])
    expect(await stock("fabricBlack")).toBeCloseTo(before - 2, 6)

    const runs = await owner<{ quantity: string }>("select quantity from public.production_runs where sale_item_id = $1", [item])
    expect(runs.rows).toHaveLength(1)
  })

  it("si falta materia prima, el encargo no avanza", async () => {
    const stockNow = await stock("fabricBlack")
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, note) values ($1, 'adjustment', $2, 'Merma total')", [
      ids.fabricBlack,
      -stockNow,
    ])
    const item = await sellGorro()
    await expect(staff("select public.set_sale_item_status($1, 'ready')", [item])).rejects.toThrow(/Stock insuficiente/)
    const status = await one(owner<{ status: string }>("select status from public.sale_item_current_status where sale_item_id = $1", [item]))
    expect(status.status).toBe("to_produce")
  })
})

describe("márgenes", () => {
  it("solo owner y admin; precio en valor real según el método, costo + mano de obra", async () => {
    expect((await staff("select * from public.product_margins()")).rows).toHaveLength(0)

    const rows = await admin<{ method_name: string; price_usdt: string; material_cost_usdt: string; labor_cost_usdt: string; margin_usdt: string; cost_source: string }>(
      "select * from public.product_margins() where sku = 'FIL-NEG-M' order by method_name"
    )
    const cost = (await avg("filBlackM"))!
    const [cash, mobile] = rows.rows
    expect(cash.method_name).toBe("Efectivo")
    expect(Number(cash.price_usdt)).toBe(30)
    expect(Number(cash.margin_usdt)).toBeCloseTo(30 - cost - 3, 5)
    expect(cash.cost_source).toBe("average")
    // Pago móvil: 30 USD × BCV 40 ÷ Binance 50 = 24 USDT reales.
    expect(Number(mobile.price_usdt)).toBe(24)
    expect(Number(mobile.margin_usdt)).toBeCloseTo(24 - cost - 3, 5)
  })

  it("sin costo promedio se estima con la receta; si falta un material, el margen queda vacío", async () => {
    // Gorro (por encargo, sin costo promedio): 0,5 m de tela negra.
    const fabric = (await avg("fabricBlack"))!
    const gorro = await one(admin<{ cost_source: string; material_cost_usdt: string }>(
      "select cost_source, material_cost_usdt from public.product_margins() where sku = 'GOR-NEG'"
    ))
    expect(gorro.cost_source).toBe("recipe")
    expect(Number(gorro.material_cost_usdt)).toBeCloseTo(0.5 * fabric, 5)

    // Filipina blanca: no hay tela blanca. No se subestima con solo los botones.
    const white = await admin<{ material_cost_usdt: string | null; margin_usdt: string | null; cost_source: string | null }>(
      "select material_cost_usdt, margin_usdt, cost_source from public.product_margins() where sku = 'FIL-BLA-M'"
    )
    expect(white.rows.length).toBeGreaterThan(0)
    for (const row of white.rows) expect(row).toEqual({ material_cost_usdt: null, margin_usdt: null, cost_source: null })
  })
})
