import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

// Venta de 1 filipina a $25, pagada (o no) con un método.
const sell = (payments: { method: string; amount: number }[] = [], customer: string | null = null) =>
  one(
    owner<{ id: string }>(
      `select public.create_sale('in_person', $1, 'pickup', $2::jsonb, $3::jsonb, $4) as id`,
      [
        ids.cashMethod,
        JSON.stringify([{ variant_id: ids.variant, quantity: 1, source: "stock" }]),
        JSON.stringify(payments.map((p) => ({ payment_method_id: ids[p.method], amount: p.amount }))),
        customer,
      ]
    )
  ).then((r) => r.id)

const editDetails = (
  as: ReturnType<typeof asUser>,
  sale: string,
  fields: { customer?: string | null; channel?: string; delivery?: string; notes?: string | null },
  reason = "Se olvidó"
) =>
  as(
    `select public.edit_sale_details($1, $2, $3::public.sale_channel, $4::public.delivery_method, $5, $6)`,
    [sale, fields.customer ?? null, fields.channel ?? "in_person", fields.delivery ?? "pickup", fields.notes ?? null, reason]
  )

const correct = (as: ReturnType<typeof asUser>, payment: string, method: string | null, amount: number | null, reason = "Método equivocado") =>
  as("select public.correct_sale_payment($1, $2, $3, $4)", [payment, method ? ids[method] : null, amount, reason])

const paymentsOf = (sale: string) =>
  owner<{ id: string; amount: string; payment_method_id: string; occurred_at: Date }>(
    "select id, amount, payment_method_id, occurred_at from public.sale_payments where sale_id = $1",
    [sale]
  ).then((r) => r.rows)

const summary = (sale: string) =>
  one(owner<{ paid_usd: string; payment_status: string }>("select * from public.sales_summary where sale_id = $1", [sale]))

const balance = (account: string) =>
  one(owner<{ balance: string }>("select balance from public.account_balances where account_id = $1", [ids[account]])).then((r) =>
    Number(r?.balance ?? 0)
  )

const history = (sale: string) =>
  owner<{ reason: string; changes: { field: string; from: unknown; to: unknown }[]; created_by: string }>(
    "select reason, changes, created_by from public.sale_edits where sale_id = $1 order by created_at",
    [sale]
  ).then((r) => r.rows)

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const accounts = await owner<{ id: string; name: string }>(
    `insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash'), ('Zelle', 'USD', 'bank')
     returning id, name`
  )
  ids.cash = accounts.rows.find((a) => a.name === "Caja")!.id
  ids.zelle = accounts.rows.find((a) => a.name === "Zelle")!.id
  for (const [key, name, account] of [
    ["cashMethod", "Efectivo", ids.cash],
    ["zelleMethod", "Zelle", ids.zelle],
  ]) {
    ids[key] = (
      await one(
        owner<{ id: string }>(
          "insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ($1, $2, 'USD', 'none') returning id",
          [name, account]
        )
      )
    ).id
  }
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina') returning id", [category.id]))
  ids.variant = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [product.id]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [product.id, ids.cashMethod])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 50, 8)", [ids.variant])
  ids.customer = (await one(owner<{ id: string }>("insert into public.customers (first_name, last_name, phone) values ('Ana', 'Pérez', '+584141234567') returning id"))).id
  ids.blocked = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Luis', '+584141234568') returning id"))).id
  await owner("select public.block_customer($1, 'Debe')", [ids.blocked])
})

describe("editar los datos de una venta", () => {
  it("owner o admin cambian cliente, canal, entrega y notas; queda en el historial con quién y el motivo", async () => {
    const sale = await sell()
    await editDetails(admin, sale, { customer: ids.customer, channel: "whatsapp", delivery: "delivery", notes: "Entregar en la tarde" }, "Faltó el cliente")
    const row = await one(owner<{ customer_id: string; channel: string; delivery_method: string; notes: string }>("select * from public.sales where id = $1", [sale]))
    expect(row).toMatchObject({ customer_id: ids.customer, channel: "whatsapp", delivery_method: "delivery", notes: "Entregar en la tarde" })

    const [edit] = await history(sale)
    expect(edit.reason).toBe("Faltó el cliente")
    expect(edit.created_by).toBe(ADMIN)
    expect(edit.changes).toEqual([
      { field: "customer", from: null, to: "Ana Pérez" },
      { field: "channel", from: "in_person", to: "whatsapp" },
      { field: "delivery_method", from: "pickup", to: "delivery" },
      { field: "notes", from: null, to: "Entregar en la tarde" },
    ])
  })

  it("staff no edita; sin motivo, sin cambios o con cliente bloqueado no pasa", async () => {
    const sale = await sell()
    await expect(editDetails(staff, sale, { notes: "x" })).rejects.toThrow(/Solo owner y admin/)
    await expect(editDetails(owner, sale, { notes: "x" }, "")).rejects.toThrow(/motivo/)
    await expect(editDetails(owner, sale, {})).rejects.toThrow(/No hay cambios/)
    await expect(editDetails(owner, sale, { customer: ids.blocked })).rejects.toThrow(/bloqueado/)
  })

  it("la venta sigue sin poder tocarse directo, y una anulada no se edita", async () => {
    const sale = await sell()
    await expect(owner("update public.sales set notes = 'x' where id = $1", [sale])).rejects.toThrow()
    await owner("select public.void_sale($1, 'Prueba')", [sale])
    await expect(editDetails(owner, sale, { notes: "x" })).rejects.toThrow(/anulada/)
  })
})

describe("corregir un pago", () => {
  it("cambiar el método: se revierte en la cuenta equivocada y entra en la correcta, con la misma fecha", async () => {
    const before = { cash: await balance("cash"), zelle: await balance("zelle") }
    const sale = await sell([{ method: "zelleMethod", amount: 25 }])
    const [original] = await paymentsOf(sale)
    await correct(owner, original.id, "cashMethod", 25)

    expect(await balance("zelle")).toBe(before.zelle)
    expect(await balance("cash")).toBe(before.cash + 25)
    const payments = await paymentsOf(sale)
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ payment_method_id: ids.cashMethod, amount: "25.00" })
    expect(new Date(payments[0].occurred_at).toISOString()).toBe(new Date(original.occurred_at).toISOString())
    expect(await summary(sale)).toMatchObject({ payment_status: "paid" })

    // El pago original sigue guardado (todos los pagos), marcado como corregido.
    const all = await owner("select id from public.sale_payments_all where sale_id = $1", [sale])
    expect(all.rows).toHaveLength(2)
    const [edit] = await history(sale)
    expect(edit.changes).toEqual([
      { field: "payment", from: { method: "Zelle", currency: "USD", amount: 25 }, to: { method: "Efectivo", currency: "USD", amount: 25 } },
    ])
  })

  it("quitar el pago deja la venta por cobrar", async () => {
    const sale = await sell([{ method: "cashMethod", amount: 25 }])
    const [payment] = await paymentsOf(sale)
    await correct(admin, payment.id, null, null, "No pagó todavía")
    expect(await summary(sale)).toMatchObject({ payment_status: "pending", paid_usd: "0.000000" })
    expect((await history(sale))[0].changes[0].to).toBeNull()
  })

  it("no se corrige dos veces, ni por más del total, ni lo hace staff", async () => {
    const sale = await sell([{ method: "cashMethod", amount: 25 }])
    const [payment] = await paymentsOf(sale)
    await expect(correct(staff, payment.id, "zelleMethod", 25)).rejects.toThrow(/Solo owner y admin/)
    await expect(correct(owner, payment.id, "zelleMethod", 30)).rejects.toThrow(/supera el saldo/)
    // Si falla, no quedó nada a medias.
    expect(await paymentsOf(sale)).toHaveLength(1)
    await correct(owner, payment.id, "zelleMethod", 20)
    await expect(correct(owner, payment.id, "cashMethod", 20)).rejects.toThrow(/ya se corrigió/)
    expect(await summary(sale)).toMatchObject({ payment_status: "partial" })
  })

  it("anular después de corregir revierte solo el pago que cuenta", async () => {
    const before = { cash: await balance("cash"), zelle: await balance("zelle") }
    const sale = await sell([{ method: "zelleMethod", amount: 25 }])
    const [payment] = await paymentsOf(sale)
    await correct(owner, payment.id, "cashMethod", 25)
    await owner("select public.void_sale($1, 'Devolución')", [sale])
    expect(await balance("cash")).toBe(before.cash)
    expect(await balance("zelle")).toBe(before.zelle)
  })

  it("el reverso de un pago solo se hace anulando o corrigiendo", async () => {
    const sale = await sell([{ method: "cashMethod", amount: 25 }])
    const entry = await one(owner<{ ledger_entry_id: string }>("select ledger_entry_id from public.sale_payments where sale_id = $1", [sale]))
    await expect(
      owner("insert into public.ledger_entries (reverses_entry_id, description) values ($1, 'x')", [entry.ledger_entry_id])
    ).rejects.toThrow()
  })
})
