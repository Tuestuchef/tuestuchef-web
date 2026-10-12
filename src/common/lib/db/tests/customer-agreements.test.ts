import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

// Venta de inventario con un método (Efectivo por defecto) y un cliente (o venta rápida).
const sell = (customer: string | null, lines: { variant: string; quantity: number }[], method = "cash") =>
  one(
    staff<{ id: string }>(`select public.create_sale('in_person', $1, 'pickup', $2::jsonb, '[]'::jsonb, $3) as id`, [
      ids[method],
      JSON.stringify(lines.map((l) => ({ variant_id: ids[l.variant], quantity: l.quantity, source: "stock" }))),
      customer,
    ])
  ).then((r) => r.id)

const prices = (sale: string) =>
  owner<{ unit_price_usd: string }>("select unit_price_usd from public.sale_items where sale_id = $1 order by created_at, id", [sale]).then((r) =>
    r.rows.map((i) => Number(i.unit_price_usd)).sort((a, b) => a - b)
  )

const sale = (id: string) =>
  one(owner<{ volume_discount_usd: string; total_usd: string }>("select volume_discount_usd, total_usd from public.sales where id = $1", [id]))

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const account = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  for (const [key, name] of [
    ["cash", "Efectivo"],
    ["zelle", "Zelle"],
  ]) {
    ids[key] = (
      await one(
        owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ($1, $2, 'USD', 'none') returning id", [
          name,
          account.id,
        ])
      )
    ).id
  }
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Delantales', 'DEL') returning id"))
  ids.school = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Escuela', '+584141234567') returning id"))).id
  ids.other = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Otro', '+584141234568') returning id"))).id

  // Tres productos de $20 (Efectivo) y $22 (Zelle): uno con precio fijo, uno con %, uno sin regla.
  for (const key of ["fixed", "percent", "plain", "exclusive"]) {
    const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, $2) returning id", [category.id, key]))
    ids[`${key}Product`] = product.id
    ids[key] = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, $2) returning id", [product.id, `DEL-${key.toUpperCase()}`]))).id
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 20), ($1, $3, 22)", [product.id, ids.cash, ids.zelle])
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 100, 5)", [ids[key]])
  }
  await owner("update public.products set exclusive_customer_id = $1 where id = $2", [ids.school, ids.exclusiveProduct])
  await owner("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('products', 10, 10)")

  await owner("insert into public.customer_agreements (customer_id, general_discount_percent) values ($1, 5)", [ids.school])
  await owner("insert into public.customer_agreement_prices (customer_id, product_id, fixed_price_usd) values ($1, $2, 12)", [ids.school, ids.fixedProduct])
  await owner("insert into public.customer_agreement_prices (customer_id, product_id, discount_percent) values ($1, $2, 25)", [ids.school, ids.percentProduct])
})

describe("acuerdos con clientes", () => {
  it("con el cliente del acuerdo: precio fijo en cualquier método, % sobre el precio del método y % general", async () => {
    const cash = await sell(ids.school, [
      { variant: "fixed", quantity: 1 },
      { variant: "percent", quantity: 1 },
      { variant: "plain", quantity: 1 },
    ])
    expect(await prices(cash)).toEqual([12, 15, 19])
    const zelle = await sell(ids.school, [
      { variant: "fixed", quantity: 1 },
      { variant: "percent", quantity: 1 },
      { variant: "plain", quantity: 1 },
    ], "zelle")
    expect(await prices(zelle)).toEqual([12, 16.5, 20.9])
    // (ordenados de menor a mayor: fijo, %, general)
  })

  it("con acuerdo no hay descuento al mayor; sin acuerdo, sí", async () => {
    const withAgreement = await sell(ids.school, [{ variant: "plain", quantity: 10 }])
    expect(await sale(withAgreement)).toMatchObject({ volume_discount_usd: "0.00", total_usd: "190.00" })
    const without = await sell(ids.other, [{ variant: "plain", quantity: 10 }])
    expect(await sale(without)).toMatchObject({ volume_discount_usd: "20.00", total_usd: "180.00" })
    expect(await prices(without)).toEqual([20])
  })

  it("un exclusivo solo se le vende a su cliente (ni a otro ni en venta rápida), ni se le cambia el cliente a la venta", async () => {
    await expect(sell(ids.other, [{ variant: "exclusive", quantity: 1 }])).rejects.toThrow(/exclusivo de Escuela/)
    await expect(sell(null, [{ variant: "exclusive", quantity: 1 }])).rejects.toThrow(/exclusivo/)
    const id = await sell(ids.school, [{ variant: "exclusive", quantity: 1 }])
    await expect(
      owner(
        "select public.edit_sale_details($1, $2, 'in_person'::public.sale_channel, 'pickup'::public.delivery_method, null, 'cambio de cliente')",
        [id, ids.other]
      )
    ).rejects.toThrow(/exclusivo/)
  })

  it("el presupuesto usa los precios del acuerdo y respeta los exclusivos", async () => {
    const save = (customer: string, variant: string) =>
      one(
        staff<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [
          JSON.stringify({ customer_id: customer, currencies: "usd", usd_price_method_id: ids.cash, items: [{ variant_id: ids[variant], quantity: 1 }] }),
        ])
      ).then((r) => r.id)
    const quote = await save(ids.school, "percent")
    const line = await one(owner<{ usd_unit_price: string }>("select usd_unit_price from public.quote_items where quote_id = $1", [quote]))
    expect(Number(line.usd_unit_price)).toBe(15)
    await expect(save(ids.other, "exclusive")).rejects.toThrow(/exclusivo/)
  })

  it("owner guarda el acuerdo con upsert (insertar o actualizar)", async () => {
    await owner(
      `insert into public.customer_agreements (customer_id, general_discount_percent) values ($1, 5)
       on conflict (customer_id) do update set customer_id = excluded.customer_id, general_discount_percent = excluded.general_discount_percent`,
      [ids.school]
    )
  })

  it("staff ve el acuerdo pero no lo cambia; los precios del catálogo no cambian", async () => {
    expect((await staff("select * from public.customer_agreement_prices")).rows).toHaveLength(2)
    await staff("update public.customer_agreements set general_discount_percent = 50 where customer_id = $1", [ids.school])
    const agreement = await one(owner<{ general_discount_percent: string }>("select general_discount_percent from public.customer_agreements where customer_id = $1", [ids.school]))
    expect(agreement.general_discount_percent).toBe("5.00")
    const catalog = await one(owner<{ price: string }>("select public.variant_price_usd($1, $2) as price", [ids.percent, ids.cash]))
    expect(Number(catalog.price)).toBe(20)
  })
})
