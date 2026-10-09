import { beforeAll, describe, expect, it } from "vitest"

import { applyMigrations, asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const variantsOf = (productId: string) =>
  owner<{ sku: string; gender: string | null }>("select sku, gender from public.product_variants where product_id = $1 order by sku", [productId]).then(
    (r) => r.rows
  )

const price = async (variant: string) =>
  Number((await one(owner<{ price: string }>("select public.variant_price_usd($1, $2) as price", [ids[variant], ids.cash]))).price)

const addVariant = (product: string, gender: string | null, size: string, sku: string) =>
  one(
    owner<{ id: string }>(
      "insert into public.product_variants (product_id, gender, color_id, size_id, sku) values ($1, $2::public.product_gender, $3, $4, $5) returning id",
      [ids[product], gender, ids.black, ids[size], sku]
    )
  ).then((r) => r.id)

beforeAll(async () => {
  // Hasta antes de esta migración: productos con el sexo en el producto, para ver cómo se convierten.
  db = await createTestDb({ until: "20261025000000" })
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const account = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  ids.cash = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [account.id]))
  ).id
  ids.fil = (await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))).id
  ids.gor = (await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Gorros', 'GOR') returning id"))).id
  ids.black = (await one(owner<{ id: string }>("insert into public.colors (name, code) values ('Negro', 'NEG') returning id"))).id
  ids.M = (await one(owner<{ id: string }>("select id from public.sizes where code = 'M'"))).id
  ids.XL3 = (await one(owner<{ id: string }>("insert into public.sizes (name, code, sort_order) values ('3XL', '3XL', 7) returning id"))).id
  ids.XL6 = (await one(owner<{ id: string }>("insert into public.sizes (name, code, sort_order) values ('6XL', '6XL', 10) returning id"))).id

  const product = async (key: string, category: string, name: string, extra = "") =>
    (ids[key] = (
      await one(
        owner<{ id: string }>(`insert into public.products (category_id, name, fulfillment_type${extra ? ", " + extra.split("=")[0] : ""}) values ($1, $2, 'stock'${extra ? ", '" + extra.split("=")[1] + "'" : ""}) returning id`, [
          ids[category],
          name,
        ])
      )
    ).id)
  const oldVariant = (productKey: string, size: string, sku: string) =>
    owner("insert into public.product_variants (product_id, color_id, size_id, sku) values ($1, $2, $3, $4)", [ids[productKey], ids.black, ids[size], sku])

  // Filipina sin sexo y sin movimientos: pasa a Dama y Caballero.
  await product("manga", "fil", "Filipina manga corta broche", "model_code=MC")
  await owner("update public.products set closure = 'snap' where id = $1", [ids.manga])
  await oldVariant("manga", "M", "FIL-MC-BR-NEG-M")
  await oldVariant("manga", "XL3", "FIL-MC-BR-NEG-3XL")
  // Filipina con stock: no se toca.
  await product("stocked", "fil", "Filipina con stock")
  await oldVariant("stocked", "M", "FIL-STK-M")
  const stockedVariant = await one(owner<{ id: string }>("select id from public.product_variants where sku = 'FIL-STK-M'"))
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity) values ($1, 'initial_count', 5)", [stockedVariant.id])
  // Filipina que ya decía Dama: sus variantes quedan de Dama.
  await product("dama", "fil", "Filipina dama", "gender=women")
  await oldVariant("dama", "M", "FIL-D-M")
  // Un gorro sin sexo: sigue sin corte.
  await product("gorro", "gor", "Gorro")
  await oldVariant("gorro", "M", "GOR-NEG")

  await applyMigrations(db, { from: "20261025000000" })

  for (const key of ["manga", "dama"]) {
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 45)", [ids[key], ids.cash])
  }
})

describe("corte: conversión de lo que existía", () => {
  it("las filipinas sin sexo, sin stock ni ventas pasan a Dama y Caballero con el corte en el SKU", async () => {
    const product = await one(owner<{ genders: string[] }>("select genders::text[] as genders from public.products where id = $1", [ids.manga]))
    expect(product.genders).toEqual(["men", "women"])
    expect(await variantsOf(ids.manga)).toEqual([
      { sku: "FIL-MC-C-BR-NEG-3XL", gender: "men" },
      { sku: "FIL-MC-C-BR-NEG-M", gender: "men" },
      { sku: "FIL-MC-D-BR-NEG-3XL", gender: "women" },
      { sku: "FIL-MC-D-BR-NEG-M", gender: "women" },
    ])
  })

  it("el sexo que tenía el producto pasa a sus variantes; lo demás no cambia", async () => {
    expect(await variantsOf(ids.dama)).toEqual([{ sku: "FIL-D-M", gender: "women" }])
    expect((await one(owner<{ genders: string[] }>("select genders::text[] as genders from public.products where id = $1", [ids.dama]))).genders).toEqual(["women"])
    // Con stock: no se toca.
    expect(await variantsOf(ids.stocked)).toEqual([{ sku: "FIL-STK-M", gender: null }])
    expect(await variantsOf(ids.gorro)).toEqual([{ sku: "GOR-NEG", gender: null }])
  })
})

describe("corte de la variante", () => {
  it("solo se usan los cortes del producto; sin cortes, la variante no lleva corte", async () => {
    await expect(addVariant("dama", "men", "XL3", "FIL-X1")).rejects.toThrow(/entre los del producto/)
    await expect(addVariant("dama", null, "XL3", "FIL-X2")).rejects.toThrow(/entre los del producto/)
    await expect(addVariant("gorro", "women", "XL3", "GOR-X")).rejects.toThrow(/no tiene cortes/)
    // Misma talla y color en otro corte: otra variante.
    await owner("update public.products set genders = '{women,men}' where id = $1", [ids.dama])
    ids.damaMenM = await addVariant("dama", "men", "M", "FIL-C-M")
    await expect(addVariant("dama", "men", "M", "FIL-C-M2")).rejects.toThrow(/product_variants_unique_combo/)
  })

  it("el corte no cambia una vez que la variante tiene movimientos", async () => {
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity) values ($1, 'initial_count', 1)", [ids.damaMenM])
    await expect(owner("update public.product_variants set gender = 'women' where id = $1", [ids.damaMenM])).rejects.toThrow(/corte/)
  })
})

describe("recargo por talla según el corte", () => {
  it("el del corte manda sobre el de todos; el de todos aplica a los demás cortes", async () => {
    for (const [key, sku] of [
      ["manM", "FIL-MC-C-BR-NEG-M"],
      ["man3", "FIL-MC-C-BR-NEG-3XL"],
      ["woman3", "FIL-MC-D-BR-NEG-3XL"],
    ] as const) {
      ids[key] = (await one(owner<{ id: string }>("select id from public.product_variants where sku = $1", [sku]))).id
    }
    await owner(
      `insert into public.size_surcharges (size_id, product_id, gender, amount_usd) values
         ($1, $2, null, 1), ($1, $2, 'men', 3)`,
      [ids.XL3, ids.manga]
    )
    expect(await price("manM")).toBe(45)
    expect(await price("man3")).toBe(48)
    expect(await price("woman3")).toBe(46)
    await expect(owner("insert into public.size_surcharges (size_id, product_id, gender, amount_usd) values ($1, $2, 'men', 5)", [ids.XL3, ids.manga])).rejects.toThrow(
      /size_surcharges_unique/
    )
  })

  it("la tabla del producto se guarda en un paso, solo owner o admin", async () => {
    const rows = [
      { size_id: ids.XL3, gender: "men", amount_usd: 3 },
      { size_id: ids.XL6, gender: "men", amount_usd: 12 },
      { size_id: ids.XL6, gender: "women", amount_usd: 4 },
    ]
    await expect(staff("select public.save_product_size_surcharges($1, $2::jsonb)", [ids.manga, JSON.stringify(rows)])).rejects.toThrow(/Solo owner o admin/)
    await owner("select public.save_product_size_surcharges($1, $2::jsonb)", [ids.manga, JSON.stringify(rows)])
    // Ya no está el de todos (+1): la dama 3XL vuelve al precio base.
    expect(await price("woman3")).toBe(45)
    expect(await price("man3")).toBe(48)
    const margin = await one(
      owner<{ price_usd: string }>("select price_usd from public.product_margins() where variant_id = $1 and payment_method_id = $2", [ids.man3, ids.cash])
    )
    expect(Number(margin.price_usd)).toBe(48)
  })
})

describe("receta por corte", () => {
  it("la línea del corte manda sobre la de todos", async () => {
    const rawCat = (await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Insumos', 'INS') returning id"))).id
    const fabric = (
      await one(owner<{ id: string }>("insert into public.products (category_id, name, kind, unit, fulfillment_type) values ($1, 'Tela', 'raw_material', 'meter', 'stock') returning id", [rawCat]))
    ).id
    const fabricBlack = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, color_id, sku) values ($1, $2, 'INS-TEL-NEG') returning id", [fabric, ids.black]))).id
    await owner(
      `insert into public.product_recipe_lines (product_id, raw_product_id, gender, quantity) values
         ($1, $2, null, 1.5), ($1, $2, 'men', 1.6)`,
      [ids.manga, fabric]
    )
    const need = async (variant: string) =>
      (await one(owner<{ raw_variant_id: string; quantity: string }>("select * from public.recipe_requirements($1, 1)", [ids[variant]])))
    expect(await need("manM")).toMatchObject({ raw_variant_id: fabricBlack, quantity: "1.600" })
    expect(await need("woman3")).toMatchObject({ raw_variant_id: fabricBlack, quantity: "1.500" })
  })
})

describe("presupuesto", () => {
  it("cada línea guarda su género, como el color y la talla", async () => {
    const payload = { customer: { name: "Hotel" }, currencies: "usd", usd_price_method_id: ids.cash, items: [{ variant_id: ids.man3, quantity: 2 }] }
    const quoteId = (await one(owner<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [JSON.stringify(payload)]))).id
    const item = await one(owner<{ gender: string; size_name: string; usd_unit_price: string }>("select gender, size_name, usd_unit_price from public.quote_items where quote_id = $1", [quoteId]))
    expect(item).toEqual({ gender: "men", size_name: "3XL", usd_unit_price: "48.00" })
  })
})
