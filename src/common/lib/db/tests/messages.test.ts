import { randomUUID } from "node:crypto"

import { beforeAll, describe, expect, it } from "vitest"

import { asServiceRole, asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
let service: ReturnType<typeof asServiceRole>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const log = (as: ReturnType<typeof asUser>, kind: string, saleId: string | null = null, phone: string | null = "+584141111111") =>
  one(as<{ id: string }>("select public.log_outbound_message($1, 'Hola', $2, null, $3) as id", [kind, phone, saleId])).then((r) => r.id)

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })
  service = asServiceRole(db)

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const account = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  const method = await one(
    owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [account.id])
  )
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina') returning id", [category.id]))
  const variant = await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [product.id]))
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [product.id, method.id])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 5, 8)", [variant.id])
  ids.customer = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Ana', '+584141111111') returning id"))).id

  const sale = await one(
    owner<{ result: { sale_id: string } }>("select public.sync_offline_sale($1, $2::jsonb) as result", [
      randomUUID(),
      JSON.stringify({
        channel: "in_person",
        price_method_id: method.id,
        delivery_method: "pickup",
        customer_id: ids.customer,
        items: [{ variant_id: variant.id, quantity: 1, source: "stock" }],
        payments: [{ payment_method_id: method.id, amount: 25 }],
        delivered: true,
      }),
    ])
  )
  ids.sale = sale.result.sale_id
})

describe("plantillas de mensajes", () => {
  it("vienen las cinco; todos las leen y solo owner y admin las editan", async () => {
    const rows = (await staff<{ kind: string }>("select kind from public.message_templates order by kind")).rows
    expect(rows).toHaveLength(5)

    await staff("update public.message_templates set body = 'x' where kind = 'sale_note'")
    expect((await one(owner<{ body: string }>("select body from public.message_templates where kind = 'sale_note'"))).body).not.toBe("x")

    const updated = await one(owner<{ updated_by: string }>("update public.message_templates set name = 'Nota' where kind = 'sale_note' returning updated_by"))
    expect(updated.updated_by).toBe(OWNER)
  })

  it("owner sin 2FA (aal1) no las edita", async () => {
    const owner1 = asUser(db, OWNER, { aal: "aal1" })
    const result = await owner1("update public.message_templates set name = 'Z' where kind = 'order_ready' returning kind")
    expect(result.rows).toHaveLength(0)
  })
})

describe("mensajes enviados", () => {
  it("se registran con el cliente de la venta, y cada quien ve los suyos", async () => {
    const id = await log(staff, "sale_note", ids.sale)
    const row = await one(owner<{ customer_id: string; created_by: string; status: string; channel: string }>("select * from public.outbound_messages where id = $1", [id]))
    expect(row).toMatchObject({ customer_id: ids.customer, created_by: STAFF, status: "opened", channel: "wa_link" })

    await log(owner, "order_ready", ids.sale)
    expect((await staff("select id from public.outbound_messages")).rows).toHaveLength(1)
    expect((await owner("select id from public.outbound_messages")).rows).toHaveLength(2)
  })

  it("el recordatorio de pago es solo de owner y admin", async () => {
    await expect(log(staff, "payment_reminder")).rejects.toThrow(/recordatorios de pago/)
    await expect(log(owner, "payment_reminder")).resolves.toBeTruthy()
  })

  it("un mensaje apagado no se envía", async () => {
    await owner("update public.message_templates set enabled = false where kind = 'order_cancelled'")
    await expect(log(staff, "order_cancelled", ids.sale)).rejects.toThrow(/apagado/)
    await owner("update public.message_templates set enabled = true where kind = 'order_cancelled'")
  })

  it("nadie lo inserta directo, lo edita ni lo borra; el servidor solo cambia el estado", async () => {
    await expect(staff("insert into public.outbound_messages (kind, body) values ('sale_note', 'x')")).rejects.toThrow(/permission denied/)
    const id = await log(owner, "sale_note", ids.sale)
    await expect(owner("update public.outbound_messages set body = 'otro' where id = $1", [id])).rejects.toThrow(/permission denied/)
    await expect(owner("select public.set_outbound_message_status($1, 'sent')", [id])).rejects.toThrow(/permission denied/)

    await service("select public.set_outbound_message_status($1, 'delivered', 'wamid.1')", [id])
    const row = await one(owner<{ status: string; provider_message_id: string; status_updated_at: Date | null }>("select * from public.outbound_messages where id = $1", [id]))
    expect(row).toMatchObject({ status: "delivered", provider_message_id: "wamid.1" })
    expect(row.status_updated_at).not.toBeNull()

    await expect(service("update public.outbound_messages set body = 'otro' where id = $1", [id])).rejects.toThrow(/solo cambia su estado/)
    await expect(service("delete from public.outbound_messages where id = $1", [id])).rejects.toThrow(/no se borran/)
  })

  it("teléfono con formato inválido no pasa", async () => {
    await expect(log(owner, "sale_note", ids.sale, "0414-111")).rejects.toThrow(/check/)
  })
})
