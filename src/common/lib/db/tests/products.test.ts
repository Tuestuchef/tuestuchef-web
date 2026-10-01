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

const move = (
  as: ReturnType<typeof asUser>,
  variant: string,
  type: string,
  quantity: number,
  extra: { cost?: number; note?: string } = {}
) =>
  as(
    `insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt, note)
     values ($1, $2, $3, $4, $5)`,
    [ids[variant], type, quantity, extra.cost ?? null, extra.note ?? null]
  )

const balance = async (variant: string) =>
  Number(
    (await owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]]))
      .rows[0].quantity
  )

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  const cat = await owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id")
  ids.cat = cat.rows[0].id
  const colors = await owner<{ id: string; code: string }>(
    "insert into public.colors (name, code) values ('Vinotinta', 'VIN'), ('Negro', 'NEG') returning id, code"
  )
  for (const c of colors.rows) ids[c.code] = c.id
  const sizes = await owner<{ id: string; code: string }>("select id, code from public.sizes")
  for (const s of sizes.rows) ids[`size_${s.code}`] = s.id

  const product = await owner<{ id: string }>(
    `insert into public.products (category_id, name, gender, closure, fulfillment_type)
     values ('${ids.cat}', 'Filipina manga corta dama broche', 'women', 'snap', 'both') returning id`
  )
  ids.product = product.rows[0].id
  const variants = await owner<{ id: string; sku: string }>(
    `insert into public.product_variants (product_id, color_id, size_id, sku) values
      ('${ids.product}', '${ids.VIN}', '${ids.size_M}', 'FIL-D-BR-VIN-M'),
      ('${ids.product}', '${ids.NEG}', '${ids.size_S}', 'FIL-D-BR-NEG-S')
     returning id, sku`
  )
  for (const v of variants.rows) ids[v.sku] = v.id
})

describe("catálogo", () => {
  it("tallas de partida en orden", async () => {
    const { rows } = await staff<{ code: string }>("select code from public.sizes order by sort_order")
    expect(rows.map((r) => r.code)).toEqual(["XS", "S", "M", "L", "XL", "XXL"])
  })

  it("staff ve el catálogo pero no lo edita", async () => {
    const { rows } = await staff("select * from public.products")
    expect(rows).toHaveLength(1)
    await expect(
      staff(`insert into public.products (category_id, name) values ('${ids.cat}', 'X')`)
    ).rejects.toThrow(/row-level security/)
    const { affectedRows } = await staff(`update public.products set name = 'Otro' where id = '${ids.product}'`)
    expect(affectedRows).toBe(0)
  })

  it("una combinación color × talla no se repite (tampoco sin talla)", async () => {
    await expect(
      owner(
        `insert into public.product_variants (product_id, color_id, size_id, sku) values ('${ids.product}', '${ids.VIN}', '${ids.size_M}', 'OTRO-SKU')`
      )
    ).rejects.toThrow(/product_variants_unique_combo/)
    await owner(`insert into public.product_variants (product_id, color_id, sku) values ('${ids.product}', '${ids.VIN}', 'FIL-VIN')`)
    await expect(
      owner(`insert into public.product_variants (product_id, color_id, sku) values ('${ids.product}', '${ids.VIN}', 'FIL-VIN-2')`)
    ).rejects.toThrow(/product_variants_unique_combo/)
  })

  it("SKU único y con formato", async () => {
    await expect(
      owner(`insert into public.product_variants (product_id, size_id, sku) values ('${ids.product}', '${ids.size_L}', 'FIL-D-BR-VIN-M')`)
    ).rejects.toThrow(/duplicate key|unique/)
    await expect(
      owner(`insert into public.product_variants (product_id, size_id, sku) values ('${ids.product}', '${ids.size_L}', 'fil d br')`)
    ).rejects.toThrow(/sku_check|check constraint/)
  })

  it("un precio por producto y método de pago, en USD", async () => {
    await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (150, 170, 100)")
    const account = await owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id")
    const method = await owner<{ id: string }>(
      `insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', '${account.rows[0].id}', 'USD', 'bcv_usd') returning id`
    )
    await owner(`insert into public.product_prices (product_id, payment_method_id, amount_usd) values ('${ids.product}', '${method.rows[0].id}', 25)`)
    await expect(
      owner(`insert into public.product_prices (product_id, payment_method_id, amount_usd) values ('${ids.product}', '${method.rows[0].id}', 26)`)
    ).rejects.toThrow(/product_prices_unique/)

    // Lo que hace el upsert de la API al guardar precios otra vez.
    await owner(
      `insert into public.product_prices (product_id, payment_method_id, amount_usd) values ('${ids.product}', '${method.rows[0].id}', 27)
       on conflict (product_id, payment_method_id) do update
       set product_id = excluded.product_id, payment_method_id = excluded.payment_method_id, amount_usd = excluded.amount_usd`
    )
    const { rows } = await staff<{ amount_usd: string }>(`select amount_usd from public.product_prices where product_id = '${ids.product}'`)
    expect(Number(rows[0].amount_usd)).toBe(27)
    await expect(
      staff(`delete from public.product_prices where product_id = '${ids.product}'`)
    ).resolves.toMatchObject({ affectedRows: 0 })
  })

  it("una sola foto principal por producto", async () => {
    const path = (n: number) => `products/${ids.product}/0000000${n}-0000-4000-8000-000000000000.jpg`
    await owner(`insert into public.product_images (product_id, path, is_primary) values ('${ids.product}', '${path(1)}', true)`)
    await expect(
      owner(`insert into public.product_images (product_id, path, is_primary) values ('${ids.product}', '${path(2)}', true)`)
    ).rejects.toThrow(/product_images_one_primary/)
    await expect(
      owner(`insert into public.product_images (product_id, path) values ('${ids.product}', 'https://x.com/a.jpg')`)
    ).rejects.toThrow(/check constraint/)
  })
})

describe("stock", () => {
  it("carga inicial: solo owner y admin, y una sola vez por variante", async () => {
    await expect(move(staff, "FIL-D-BR-VIN-M", "initial_count", 10)).rejects.toThrow(/row-level security/)
    await move(admin, "FIL-D-BR-VIN-M", "initial_count", 10)
    await expect(move(owner, "FIL-D-BR-VIN-M", "initial_count", 5)).rejects.toThrow(/ya tiene movimientos/)
    expect(await balance("FIL-D-BR-VIN-M")).toBe(10)
  })

  it("staff registra producción (con costo); las compras solo desde el módulo de compras", async () => {
    await expect(move(staff, "FIL-D-BR-VIN-M", "purchase", 5, { cost: 12.5 })).rejects.toThrow(/módulo de compras/)
    // Producción: solo con register_production. Sin receta exige el costo unitario.
    await expect(move(staff, "FIL-D-BR-VIN-M", "production", 3, { cost: 9 })).rejects.toThrow(/Stock → Producción/)
    await expect(staff("select public.register_production($1, 3)", [ids["FIL-D-BR-VIN-M"]])).rejects.toThrow(/no tiene receta/)
    await staff("select public.register_production($1, 3, 9)", [ids["FIL-D-BR-VIN-M"]])
    expect(await balance("FIL-D-BR-VIN-M")).toBe(13)
    const { rows } = await owner<{ unit_cost_usdt: string }>(
      `select unit_cost_usdt from public.product_variants where id = '${ids["FIL-D-BR-VIN-M"]}'`
    )
    expect(Number(rows[0].unit_cost_usdt)).toBe(9)
  })

  it("staff no hace ajustes", async () => {
    await expect(move(staff, "FIL-D-BR-VIN-M", "adjustment", -1, { note: "conteo" })).rejects.toThrow(/row-level security/)
  })

  it("ajuste de owner o admin con motivo obligatorio", async () => {
    await expect(move(owner, "FIL-D-BR-VIN-M", "adjustment", -2)).rejects.toThrow(/motivo/)
    await move(owner, "FIL-D-BR-VIN-M", "adjustment", -2, { note: "Conteo físico" })
    expect(await balance("FIL-D-BR-VIN-M")).toBe(11)
  })

  it("stock negativo bloqueado", async () => {
    await expect(move(owner, "FIL-D-BR-VIN-M", "adjustment", -12, { note: "x" })).rejects.toThrow(/Stock insuficiente/)
    await expect(move(owner, "FIL-D-BR-NEG-S", "adjustment", -1, { note: "x" })).rejects.toThrow(/Stock insuficiente/)
    expect(await balance("FIL-D-BR-VIN-M")).toBe(11)
  })

  it("signos y ventas reservadas al módulo de ventas", async () => {
    await expect(move(owner, "FIL-D-BR-VIN-M", "initial_count", -1, { cost: 1 })).rejects.toThrow(/Cantidad inválida|ya tiene movimientos/)
    await expect(move(owner, "FIL-D-BR-VIN-M", "purchase", 1, { cost: 1 })).rejects.toThrow(/módulo de compras/)
    await expect(move(owner, "FIL-D-BR-VIN-M", "sale", -1)).rejects.toThrow(/módulo de ventas/)
  })

  it("SKU, color y talla no cambian con movimientos; sin movimientos sí", async () => {
    await expect(
      owner(`update public.product_variants set sku = 'NUEVO-SKU' where id = '${ids["FIL-D-BR-VIN-M"]}'`)
    ).rejects.toThrow(/ya tiene movimientos/)
    await expect(
      owner(`update public.product_variants set size_id = '${ids.size_L}' where id = '${ids["FIL-D-BR-VIN-M"]}'`)
    ).rejects.toThrow(/ya tiene movimientos/)
    await owner(`update public.product_variants set sku = 'FIL-D-BR-NEG-S2' where id = '${ids["FIL-D-BR-NEG-S"]}'`)
    await owner(`update public.product_variants set min_stock = 3 where id = '${ids["FIL-D-BR-VIN-M"]}'`)
  })

  it("movimientos inmutables (ni owner ni superusuario)", async () => {
    await expect(owner("update public.stock_movements set quantity = 100")).rejects.toThrow(/permission denied/)
    await expect(owner("delete from public.stock_movements")).rejects.toThrow(/permission denied/)
    await expect(db.query("update public.stock_movements set quantity = 100")).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.stock_movements")).rejects.toThrow(/no se editan/)
  })

  it("alerta de stock bajo", async () => {
    await owner(`update public.product_variants set min_stock = 20 where id = '${ids["FIL-D-BR-VIN-M"]}'`)
    const { rows } = await staff<{ is_low: boolean }>(
      `select is_low from public.stock_balances where variant_id = '${ids["FIL-D-BR-VIN-M"]}'`
    )
    expect(rows[0].is_low).toBe(true)
  })

  it("productos solo por encargo no llevan stock", async () => {
    const product = await owner<{ id: string }>(
      `insert into public.products (category_id, name, fulfillment_type) values ('${ids.cat}', 'Bordado a medida', 'made_to_order') returning id`
    )
    const variant = await owner<{ id: string }>(
      `insert into public.product_variants (product_id, sku) values ('${product.rows[0].id}', 'FIL-MED') returning id`
    )
    ids["FIL-MED"] = variant.rows[0].id
    await expect(move(owner, "FIL-MED", "initial_count", 1)).rejects.toThrow(/por encargo/)
  })
})

describe("carga inicial en lote", () => {
  it("todo o nada: un SKU malo no deja nada cargado", async () => {
    const v = await owner<{ id: string }>(
      `insert into public.product_variants (product_id, color_id, size_id, sku) values ('${ids.product}', '${ids.NEG}', '${ids.size_L}', 'FIL-D-BR-NEG-L') returning id`
    )
    ids["FIL-D-BR-NEG-L"] = v.rows[0].id
    await expect(
      owner("select public.load_initial_stock($1::jsonb)", [
        [
          { sku: "FIL-D-BR-NEG-L", quantity: 4 },
          { sku: "NO-EXISTE", quantity: 1 },
        ],
      ])
    ).rejects.toThrow(/SKU no encontrado/)
    expect(await balance("FIL-D-BR-NEG-L")).toBe(0)

    const { rows } = await owner<{ n: number }>("select public.load_initial_stock($1::jsonb) n", [
      [{ sku: "fil-d-br-neg-l", quantity: 4 }],
    ])
    expect(rows[0].n).toBe(1)
    expect(await balance("FIL-D-BR-NEG-L")).toBe(4)
  })

  it("staff no puede hacer la carga inicial", async () => {
    await expect(
      staff("select public.load_initial_stock($1::jsonb)", [[{ sku: "FIL-D-BR-NEG-S2", quantity: 1 }]])
    ).rejects.toThrow(/row-level security/)
  })
})
