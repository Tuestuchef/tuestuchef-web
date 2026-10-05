import { beforeAll, describe, expect, it } from "vitest"

import { asServiceRole, asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
let service: ReturnType<typeof asServiceRole>

const items = (kind: string) =>
  service<{ item_key: string; title: string; detail: string; url: string }>("select * from public.notification_items($1::public.notification_kind)", [kind]).then(
    (r) => r.rows
  )

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })
  service = asServiceRole(db)
})

describe("configuración de avisos", () => {
  it("vienen los seis avisos prendidos, con sus roles", async () => {
    const rows = await owner<{ kind: string; enabled: boolean; roles: string }>("select kind, enabled, roles::text from public.notification_settings order by kind")
    expect(rows.rows).toHaveLength(6)
    expect(rows.rows.every((r) => r.enabled)).toBe(true)
  })

  it("owner y admin prenden y apagan cada aviso y cada canal; staff no", async () => {
    await admin("update public.notification_settings set enabled = false, push_enabled = false where kind = 'low_stock'")
    await owner("update public.notification_channel_settings set email_enabled = false")
    const row = (await owner<{ enabled: boolean }>("select enabled from public.notification_settings where kind = 'low_stock'")).rows[0]
    expect(row.enabled).toBe(false)
    expect((await owner<{ email_enabled: boolean }>("select email_enabled from public.notification_channel_settings")).rows[0].email_enabled).toBe(false)

    expect((await staff("select * from public.notification_settings")).rows).toHaveLength(0)
    await staff("update public.notification_settings set enabled = false where kind = 'late_orders'")
    expect((await owner<{ enabled: boolean }>("select enabled from public.notification_settings where kind = 'late_orders'")).rows[0].enabled).toBe(true)
    await expect(owner("update public.notification_settings set roles = '{}' where kind = 'late_orders'")).rejects.toThrow()
  })
})

describe("dispositivos", () => {
  it("cada persona registra y ve solo sus dispositivos", async () => {
    await staff("insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'a')")
    await owner("insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/b', 'k', 'a')")
    expect((await staff("select * from public.push_subscriptions")).rows).toHaveLength(1)
    await expect(
      staff("insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values ($1, 'https://push.example/c', 'k', 'a')", [OWNER])
    ).rejects.toThrow()
  })
})

describe("lo pendiente de cada aviso", () => {
  it("solo el servidor lo consulta", async () => {
    await expect(owner("select * from public.notification_items('missing_rate')")).rejects.toThrow()
  })

  it("avisa si falta la tasa de hoy", async () => {
    expect(await items("missing_rate")).toHaveLength(1)
    await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
    expect(await items("missing_rate")).toHaveLength(0)
  })

  it("avisa del stock bajo y de las compras por vencer", async () => {
    const category = (await owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id")).rows[0].id
    const product = (await owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina') returning id", [category])).rows[0].id
    const variant = (await owner<{ id: string }>("insert into public.product_variants (product_id, sku, min_stock) values ($1, 'FIL-1', 5) returning id", [product])).rows[0].id
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 3, 8)", [variant])
    const low = await items("low_stock")
    expect(low[0]).toMatchObject({ title: "Filipina · FIL-1", url: `/productos/${product}` })

    const account = (await owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id")).rows[0].id
    const cost = (await owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Telas', 'cost') returning id")).rows[0].id
    void account
    const supplier = (await owner<{ id: string }>("insert into public.suppliers (name) values ('Textiles') returning id")).rows[0].id
    await owner(
      `select public.create_purchase($1, $2::jsonb, '[]'::jsonb, public.caracas_today() + 2)`,
      [supplier, JSON.stringify([{ line_type: "concept", description: "Tela", quantity: 1, unit_cost_usd: 100, category_id: cost }])]
    )
    const due = await items("payables_due")
    expect(due).toHaveLength(1)
    expect(due[0].detail).toMatch(/Vence el/)
  })
})

describe("configuración de pedidos", () => {
  it("owner y admin guardan las reglas de pedidos (corrige el trigger de auditoría)", async () => {
    await admin("update public.order_settings set deposit_percent = 50")
    const row = (await owner<{ deposit_percent: string; updated_by: string }>("select deposit_percent, updated_by from public.order_settings")).rows[0]
    expect(Number(row.deposit_percent)).toBe(50)
    expect(row.updated_by).toBe(ADMIN)
  })
})
