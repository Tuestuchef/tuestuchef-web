import { randomUUID } from "node:crypto"

import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const payload = (quantity: number, extra: Record<string, unknown> = {}) => ({
  channel: "in_person",
  price_method_id: ids.cash,
  delivery_method: "pickup",
  items: [{ variant_id: ids.variant, quantity, source: "stock" }],
  payments: [{ payment_method_id: ids.cash, amount: 25 * quantity }],
  delivered: true,
  occurred_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  ...extra,
})

const sync = (as: ReturnType<typeof asUser>, ref: string, body: object) =>
  one(as<{ result: { status: string; sale_id?: string; error?: string } }>("select public.sync_offline_sale($1, $2::jsonb) as result", [ref, JSON.stringify(body)])).then(
    (r) => r.result
  )

const stock = () => one(owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids.variant])).then((r) => Number(r.quantity))

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
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina') returning id", [category.id]))
  ids.variant = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [product.id]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25)", [product.id, ids.cash])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 5, 8)", [ids.variant])
})

describe("ventas sin conexión", () => {
  it("se registra con la hora en que se hizo, y reenviarla no la duplica", async () => {
    const ref = randomUUID()
    const body = payload(2)
    const first = await sync(staff, ref, body)
    expect(first.status).toBe("created")
    const sale = await one(owner<{ occurred_at: Date }>("select occurred_at from public.sales where id = $1", [first.sale_id]))
    expect(new Date(sale.occurred_at).toISOString()).toBe(body.occurred_at)

    const again = await sync(staff, ref, body)
    expect(again).toMatchObject({ status: "duplicate", sale_id: first.sale_id })
    expect(await stock()).toBe(3)
  })

  it("si no pasa (p. ej. sin stock), queda guardada con el motivo y no se pierde", async () => {
    const ref = randomUUID()
    const result = await sync(staff, ref, payload(10))
    expect(result.status).toBe("rejected")
    expect(result.error).toMatch(/Stock insuficiente/)
    expect(await stock()).toBe(3)

    const row = await one(staff<{ error: string; attempts: number; payload: { items: unknown[] } }>("select * from public.offline_sale_rejections where client_ref = $1", [ref]))
    expect(row.payload.items).toHaveLength(1)
    // Un nuevo intento suma, no duplica.
    await sync(staff, ref, payload(10))
    expect((await one(staff<{ attempts: number }>("select attempts from public.offline_sale_rejections where client_ref = $1", [ref]))).attempts).toBe(2)
    ids.rejected = (await one(owner<{ id: string }>("select id from public.offline_sale_rejections where client_ref = $1", [ref]))).id
  })

  it("respeta el límite de días de staff", async () => {
    const old = payload(1, { occurred_at: new Date(Date.now() - 20 * 86400_000).toISOString() })
    const result = await sync(staff, randomUUID(), old)
    expect(result.status).toBe("rejected")
  })

  it("owner o admin reintentan (cuando ya hay stock) y queda resuelta", async () => {
    await expect(staff("select public.retry_offline_sale($1)", [ids.rejected])).rejects.toThrow(/Solo owner y admin/)
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, note) values ($1, 'adjustment', 10, 'Conteo')", [ids.variant])
    const result = await one(owner<{ r: { status: string } }>("select public.retry_offline_sale($1) as r", [ids.rejected]))
    expect(result.r.status).toBe("created")
    const row = await one(owner<{ resolved_sale_id: string | null }>("select resolved_sale_id from public.offline_sale_rejections where id = $1", [ids.rejected]))
    expect(row.resolved_sale_id).not.toBeNull()
    await expect(owner("select public.retry_offline_sale($1)", [ids.rejected])).rejects.toThrow(/ya se resolvió/)
  })

  it("descartar pide motivo; el contenido no se edita ni se borra", async () => {
    const ref = randomUUID()
    await sync(staff, ref, payload(1, { customer_id: randomUUID() }))
    const row = await one(owner<{ id: string }>("select id from public.offline_sale_rejections where client_ref = $1", [ref]))
    await expect(owner("select public.discard_offline_sale($1, '')", [row.id])).rejects.toThrow(/motivo/)
    await owner("select public.discard_offline_sale($1, 'Se registró a mano')", [row.id])
    await expect(owner("update public.offline_sale_rejections set error = 'x' where id = $1", [row.id])).rejects.toThrow()
    await expect(owner("delete from public.offline_sale_rejections where id = $1", [row.id])).rejects.toThrow()
  })

  it("staff ve solo sus ventas pendientes", async () => {
    const own = await staff("select * from public.offline_sale_rejections")
    expect(own.rows.length).toBeGreaterThan(0)
    expect((await owner("select * from public.offline_sale_rejections")).rows.length).toBe(own.rows.length)
  })
})
