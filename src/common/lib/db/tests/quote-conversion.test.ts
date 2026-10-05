import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

type Sale = { id: string; total_usd: string; vat_usd: string; vat_percent: string; subtotal_usd: string; discount_usd: string; volume_discount_usd: string; customer_id: string }

const quotePayload = (extra: Record<string, unknown> = {}) => ({
  customer: { name: "Restaurante Litoral" },
  currencies: "both",
  usd_price_method_id: ids.cash,
  ves_price_method_id: ids.mobile,
  vat_enabled: true,
  items: [{ variant_id: ids.shirt, quantity: 10, discount_percent: 10 }],
  discount_reason: "Pedido grande",
  ...extra,
})

// Hace un presupuesto, lo envía y lo marca aceptado (como owner: el descuento por línea no tiene límite).
async function acceptedQuote(extra: Record<string, unknown> = {}) {
  const id = (await one(owner<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [JSON.stringify(quotePayload(extra))]))).id
  await owner("select public.send_quote($1)", [id])
  await owner("select public.mark_quote($1, 'accepted')", [id])
  return id
}

const convert = (as: ReturnType<typeof asUser>, quoteId: string, opts: { customer?: string | null; currency?: string; details?: object } = {}) =>
  one(
    as<{ id: string }>(
      "select public.convert_quote_to_order($1, $2, $3, 'produce_all', null, 'whatsapp', 'pickup', null, $4::jsonb) as id",
      [quoteId, opts.customer === undefined ? ids.customer : opts.customer, opts.currency ?? "usd", JSON.stringify(opts.details ?? {})]
    )
  ).then((r) => r.id)

beforeAll(async () => {
  db = await createTestDb()
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
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  ids.product = (
    await one(owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Filipina', 'made_to_order') returning id", [category.id]))
  ).id
  ids.shirt = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [ids.product]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25), ($1, $3, 28)", [ids.product, ids.cash, ids.mobile])
  await owner("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('products', 10, 5)")
  ids.embroidery = (await one(owner<{ id: string }>("select id from public.customization_types where code = 'embroidered_name'"))).id
  ids.customer = (await one(owner<{ id: string }>("insert into public.customers (kind, first_name, legal_name) values ('company', 'Litoral', 'Litoral C.A.') returning id"))).id
})

describe("convertir un presupuesto en pedido", () => {
  it("copia precios y totales del presupuesto (con IVA) y el pedido cobra exactamente lo aceptado", async () => {
    const quoteId = await acceptedQuote()
    const quote = await one(owner<{ usd_total: string; ves_total: string; usd_vat: string }>("select usd_total, ves_total, usd_vat from public.quotes where id = $1", [quoteId]))
    // 10 × 25 − 10% = 225; − 5% al mayor = 213,75; IVA 16% = 34,20; total 247,95.
    expect(quote).toMatchObject({ usd_total: "247.95", usd_vat: "34.20" })

    // Aunque la lista cambie después, el pedido usa el precio del presupuesto.
    await owner("update public.product_prices set amount_usd = 40 where product_id = $1 and payment_method_id = $2", [ids.product, ids.cash])
    const saleId = await convert(staff, quoteId)
    const sale = await one(owner<Sale>("select * from public.sales where id = $1", [saleId]))
    expect(sale).toMatchObject({ total_usd: "247.95", vat_usd: "34.20", vat_percent: "16.00", customer_id: ids.customer })

    // Regla de abono sobre el total con IVA (menos de 500: completo).
    const order = await one(owner<{ deposit_required_usd: string }>("select deposit_required_usd from public.orders where sale_id = $1", [saleId]))
    expect(order.deposit_required_usd).toBe("247.95")

    const link = await one(owner<{ order_sale_id: string; status: string }>("select order_sale_id, status from public.quotes where id = $1", [quoteId]))
    expect(link).toEqual({ order_sale_id: saleId, status: "accepted" })
    await owner("update public.product_prices set amount_usd = 25 where product_id = $1 and payment_method_id = $2", [ids.product, ids.cash])
  })

  it("con la lista en Bs, el pedido cobra el total en Bs del presupuesto", async () => {
    const quoteId = await acceptedQuote()
    const expected = (await one(owner<{ ves_total: string }>("select ves_total from public.quotes where id = $1", [quoteId]))).ves_total
    const saleId = await convert(staff, quoteId, { currency: "ves" })
    expect((await one(owner<Sale>("select * from public.sales where id = $1", [saleId]))).total_usd).toBe(expected)
  })

  it("se convierte una sola vez", async () => {
    const quoteId = await acceptedQuote()
    await convert(staff, quoteId)
    await expect(convert(staff, quoteId)).rejects.toThrow(/ya se convirtió/)
  })

  it("solo un aceptado; un presupuesto sin cliente pide uno", async () => {
    const draft = (await one(owner<{ id: string }>("select public.save_quote_draft(null, $1::jsonb) as id", [JSON.stringify(quotePayload())]))).id
    await expect(convert(staff, draft)).rejects.toThrow(/aceptado/)
    const quoteId = await acceptedQuote()
    await expect(convert(staff, quoteId, { customer: null })).rejects.toThrow(/necesita cliente/)
  })

  it("un cliente bloqueado no recibe el pedido", async () => {
    const blocked = (await one(owner<{ id: string }>("insert into public.customers (kind, first_name, legal_name) values ('company', 'Moroso', 'Moroso C.A.') returning id"))).id
    const quoteId = await acceptedQuote()
    await owner("select public.block_customer($1, 'Deuda')", [blocked])
    await expect(convert(staff, quoteId, { customer: blocked })).rejects.toThrow(/bloqueado/)
  })

  it("la personalización que pide nombres los recibe al convertir", async () => {
    const quoteId = await acceptedQuote({
      items: [{ variant_id: ids.shirt, quantity: 2, customizations: [{ type_id: ids.embroidery, quantity: 2 }] }],
      discount_reason: null,
    })
    await expect(convert(staff, quoteId)).rejects.toThrow(/nombres/)
    const customizationId = (
      await one(
        owner<{ id: string }>(
          "select qc.id from public.quote_item_customizations qc join public.quote_items qi on qi.id = qc.quote_item_id where qi.quote_id = $1",
          [quoteId]
        )
      )
    ).id
    const saleId = await convert(staff, quoteId, { details: { [customizationId]: { names: ["Ana", "Luis"] } } })
    const names = (await owner<{ name: string }>(
      "select n.name from public.sale_item_customization_names n join public.sale_item_customizations c on c.id = n.customization_id join public.sale_items i on i.id = c.sale_item_id where i.sale_id = $1 order by n.ordinal",
      [saleId]
    )).rows
    expect(names.map((n) => n.name)).toEqual(["Ana", "Luis"])
    const quote = await one(owner<{ usd_total: string }>("select usd_total from public.quotes where id = $1", [quoteId]))
    expect((await one(owner<Sale>("select * from public.sales where id = $1", [saleId]))).total_usd).toBe(quote.usd_total)
  })
})

describe("IVA en ventas y pedidos", () => {
  it("un pedido normal puede llevar IVA sobre el total", async () => {
    const saleId = (
      await one(
        owner<{ id: string }>(
          "select public.create_order($1, $2, 'whatsapp', 'pickup', $3::jsonb, 'produce_all', null, '[]', 0, null, null, null, null, null, 16) as id",
          [ids.customer, ids.cash, JSON.stringify([{ variant_id: ids.shirt, quantity: 2 }])]
        )
      )
    ).id
    expect(await one(owner<Sale>("select * from public.sales where id = $1", [saleId]))).toMatchObject({ subtotal_usd: "50.00", vat_usd: "8.00", total_usd: "58.00" })
  })

  it("el IVA cobrado no cuenta como ingreso en la utilidad", async () => {
    const saleId = (
      await one(
        owner<{ id: string }>(
          "select public.create_order($1, $2, 'whatsapp', 'pickup', $3::jsonb, 'produce_all', null, '[]', 0, null, null, null, null, null, 16) as id",
          [ids.customer, ids.cash, JSON.stringify([{ variant_id: ids.shirt, quantity: 4 }])]
        )
      )
    ).id
    // 4 × 25 = 100 + IVA 16 = 116, pagado completo en efectivo.
    await owner("select public.add_sale_payment($1, $2, 116)", [saleId, ids.cash])
    const paid = Number(
      (
        await one(
          owner<{ v: string }>(
            "select sum(l.usdt_value) as v from public.sale_payments sp join public.ledger_entries l on l.id = sp.ledger_entry_id where sp.sale_id = $1",
            [saleId]
          )
        )
      ).v
    )
    const today = (await one(owner<{ d: string }>("select public.caracas_today()::text as d"))).d
    const rows = (await owner<{ category_type: string; usdt_value: string }>("select category_type, usdt_value from public.analytics_ledger_summary($1, $1)", [today])).rows
    const sum = (type: string) => rows.filter((r) => r.category_type === type).reduce((s, r) => s + Number(r.usdt_value), 0)
    // De cada 116 cobrados, 16 son IVA (aparte, no suman a la utilidad) y 100 son venta.
    expect(sum("vat_collected")).toBeCloseTo((paid * 16) / 116, 4)
    expect(sum("sales") + sum("vat_collected")).toBeCloseTo(paid, 4)
    // period_totals es interna (la usa el cierre de mes).
    const totals = (await db.query<{ t: Record<string, number> }>("select public.period_totals(date_trunc('month', public.caracas_today())::date) as t")).rows[0].t
    expect(Number(totals.vat_collected)).toBeCloseTo((paid * 16) / 116, 2)
  })

  it("al cancelar un pedido con IVA, el reembolso descuenta su parte de IVA y su parte de venta", async () => {
    const before = await (async () => {
      const today = (await one(owner<{ d: string }>("select public.caracas_today()::text as d"))).d
      const rows = (await owner<{ category_type: string; usdt_value: string }>("select category_type, usdt_value from public.analytics_ledger_summary($1, $1)", [today])).rows
      return (type: string) => rows.filter((r) => r.category_type === type).reduce((s, r) => s + Number(r.usdt_value), 0)
    })()
    const saleId = (
      await one(
        owner<{ id: string }>(
          "select public.create_order($1, $2, 'whatsapp', 'pickup', $3::jsonb, 'produce_all', null, $4::jsonb, 0, null, null, null, null, null, 16) as id",
          [ids.customer, ids.cash, JSON.stringify([{ variant_id: ids.shirt, quantity: 2 }]), JSON.stringify([{ payment_method_id: ids.cash, amount: 58 }])]
        )
      )
    ).id
    await owner("select public.cancel_order($1, 'El cliente desistió', null)", [saleId])
    const refund = await one(owner<{ sale_id: string }>("select sale_id from public.ledger_entries where entry_type = 'sale_refund' order by created_at desc limit 1"))
    expect(refund.sale_id).toBe(saleId)

    const today = (await one(owner<{ d: string }>("select public.caracas_today()::text as d"))).d
    const rows = (await owner<{ category_type: string; usdt_value: string }>("select category_type, usdt_value from public.analytics_ledger_summary($1, $1)", [today])).rows
    const after = (type: string) => rows.filter((r) => r.category_type === type).reduce((s, r) => s + Number(r.usdt_value), 0)
    // Cobro y reembolso completo se anulan: ni venta ni IVA cambian.
    expect(after("sales")).toBeCloseTo(before("sales"), 4)
    expect(after("vat_collected")).toBeCloseTo(before("vat_collected"), 4)
  })

  it("nadie crea una categoría de IVA cobrado ni llama a los motores directo", async () => {
    await expect(owner("insert into public.movement_categories (name, type) values ('IVA', 'vat_collected')")).rejects.toThrow(/movement_categories_not_vat|check/)
    await expect(staff("select public.create_order_engine(null, null, 'whatsapp', 'pickup', '[]', 'produce_all')")).rejects.toThrow(/permission denied/)
  })
})
