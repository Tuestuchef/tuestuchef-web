import { beforeAll, describe, expect, it } from "vitest"

import { asServiceRole, asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
let service: ReturnType<typeof asServiceRole>
const ids: Record<string, string> = {}

type QuoteRow = {
  id: string
  number: number
  version: number
  code: string
  status: string
  customer_name: string
  pieces: string
  volume_discount_percent: string
  usd_subtotal: string
  usd_volume_discount: string
  usd_discount: string
  usd_vat: string
  usd_total: string
  ves_total: string
  ves_total_bs: string
  ves_rate: string
  superseded_by: string | null
  public_token: string | null
  created_by_name: string
}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]
const quote = (id: string) => one(owner<QuoteRow>("select * from public.quotes where id = $1", [id]))

const payload = (extra: Record<string, unknown> = {}) => ({
  customer: { name: "Restaurante Litoral" },
  currencies: "usd",
  usd_price_method_id: ids.cash,
  items: [{ variant_id: ids.shirt, quantity: 2 }],
  ...extra,
})

const save = (as: ReturnType<typeof asUser>, body: object, id: string | null = null) =>
  one(as<{ id: string }>("select public.save_quote_draft($1, $2::jsonb) as id", [id, JSON.stringify(body)])).then((r) => r.id)

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })
  service = asServiceRole(db)

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const usd = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  const ves = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id"))
  ids.cash = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [usd.id]))
  ).id
  ids.mobile = (
    await one(
      owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'VES', 'bcv_usd') returning id", [ves.id])
    )
  ).id

  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  const product = await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina') returning id", [category.id]))
  const size = await one(owner<{ id: string }>("select id from public.sizes order by sort_order limit 1"))
  ids.shirt = (
    await one(owner<{ id: string }>("insert into public.product_variants (product_id, size_id, sku) values ($1, $2, 'FIL-M') returning id", [product.id, size.id]))
  ).id
  // Lista en USD: 25. Lista en Bs: 28 (USD de referencia, se muestra × tasa BCV).
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25), ($1, $3, 28)", [product.id, ids.cash, ids.mobile])
  await owner("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('products', 10, 5)")
  ids.embroidery = (await one(owner<{ id: string }>("select id from public.customization_types where code = 'embroidered_name'"))).id

  ids.blocked = (
    await one(owner<{ id: string }>("insert into public.customers (kind, first_name, legal_name) values ('company', 'Moroso', 'Moroso C.A.') returning id"))
  ).id
  await owner("select public.block_customer($1, 'Canceló con reembolso')", [ids.blocked])
})

describe("numeración", () => {
  it("es única, secuencial y sin huecos aunque un guardado falle", async () => {
    await owner("update public.quote_settings set next_number = 9574")
    const first = await quote(await save(staff, payload()))
    // Falla (sin productos): no consume número.
    await expect(save(staff, payload({ items: [] }))).rejects.toThrow(/al menos un producto/)
    const second = await quote(await save(staff, payload()))
    expect(first).toMatchObject({ number: 9574, code: "TLT09574", status: "draft" })
    expect(second).toMatchObject({ number: 9575, code: "TLT09575" })
    expect((await one(owner<{ next_number: number }>("select next_number from public.quote_settings"))).next_number).toBe(9576)
  })

  it("el avance del número no cuenta como cambio de la configuración", async () => {
    const before = await one(owner<{ updated_by: string }>("select updated_by from public.quote_settings"))
    await save(staff, payload())
    expect((await one(owner<{ updated_by: string }>("select updated_by from public.quote_settings"))).updated_by).toBe(before.updated_by)
  })

  it("guarda quién lo generó", async () => {
    const row = await quote(await save(staff, payload()))
    expect(row.created_by_name).not.toBe("")
  })
})

describe("precios", () => {
  it("cada moneda sale de su lista; Bs a la tasa BCV; al mayor por piezas; IVA sobre el total", async () => {
    const id = await save(
      owner,
      payload({ currencies: "both", ves_price_method_id: ids.mobile, vat_enabled: true, items: [{ variant_id: ids.shirt, quantity: 10 }] })
    )
    const row = await quote(id)
    // USD: 10 × 25 = 250; 5% al mayor = 12,50; base 237,50; IVA 16% = 38,00; total 275,50.
    expect(row).toMatchObject({ pieces: "10.000", volume_discount_percent: "5.00", usd_subtotal: "250.00", usd_volume_discount: "12.50", usd_vat: "38.00", usd_total: "275.50" })
    // Bs: 10 × 28 = 280; −14 = 266; IVA 42,56; total 308,56 (USD ref) × 40 = 12.342,40 Bs.
    expect(row).toMatchObject({ ves_total: "308.56", ves_rate: "40.000000", ves_total_bs: "12342.40" })
  })

  it("la personalización suma con su precio (igual en ambas listas)", async () => {
    const id = await save(
      owner,
      payload({ items: [{ variant_id: ids.shirt, quantity: 2, customizations: [{ type_id: ids.embroidery, quantity: 2 }] }] })
    )
    // 2 × 25 + 2 × 4 = 58.
    expect((await quote(id)).usd_total).toBe("58.00")
  })

  it("descuento con motivo y límite de staff (por presupuesto y por línea)", async () => {
    await expect(save(staff, payload({ discount_type: "percent", discount_value: 5 }))).rejects.toThrow(/motivo/)
    await expect(save(staff, payload({ discount_type: "percent", discount_value: 50, discount_reason: "Cliente fiel" }))).rejects.toThrow(/máximo/)
    await expect(
      save(staff, payload({ discount_reason: "Cliente fiel", items: [{ variant_id: ids.shirt, quantity: 2, discount_percent: 50 }] }))
    ).rejects.toThrow(/máximo/)
    const id = await save(owner, payload({ discount_type: "percent", discount_value: 50, discount_reason: "Cliente fiel" }))
    expect((await quote(id)).usd_total).toBe("25.00")
  })

  it("sin lista de precios de la moneda elegida no se guarda", async () => {
    await expect(save(staff, payload({ currencies: "ves" }))).rejects.toThrow(/lista de precios en Bs/)
  })
})

describe("estados e inmutabilidad", () => {
  it("al enviarse queda congelado: no se edita ni por función, ni directo, ni sus líneas", async () => {
    const id = await save(staff, payload())
    const token = (await one(staff<{ token: string }>("select public.send_quote($1) as token", [id]))).token
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect((await quote(id)).status).toBe("sent")

    await expect(save(staff, payload(), id)).rejects.toThrow(/ya no es un borrador/)
    await expect(owner("update public.quotes set customer_name = 'Otro' where id = $1", [id])).rejects.toThrow(/permission denied/)
    await expect(service("update public.quotes set usd_total = 1 where id = $1", [id])).rejects.toThrow(/ya no es un borrador/)
    await expect(service("update public.quote_items set quantity = 99 where quote_id = $1", [id])).rejects.toThrow(/no cambian/)
    await expect(service("delete from public.quotes where id = $1", [id])).rejects.toThrow(/no se borran/)
  })

  it("la versión nueva conserva la anterior (reemplazada, con sus líneas) y usa el mismo número", async () => {
    const id = await save(staff, payload())
    await staff("select public.send_quote($1)", [id])
    const v2 = (await one(staff<{ id: string }>("select public.new_quote_version($1) as id", [id]))).id

    const [old, next] = [await quote(id), await quote(v2)]
    expect(next).toMatchObject({ number: old.number, version: 2, code: `${old.code}-v2`, status: "draft" })
    expect(old).toMatchObject({ status: "superseded", superseded_by: v2 })
    expect((await owner("select id from public.quote_items where quote_id = $1", [id])).rows).toHaveLength(1)
    expect((await owner("select id from public.quote_items where quote_id = $1", [v2])).rows).toHaveLength(1)

    await expect(staff("select public.new_quote_version($1)", [id])).rejects.toThrow(/más nueva/)
    await expect(staff("select public.mark_quote($1, 'accepted')", [id])).rejects.toThrow(/enviado y vigente/)
  })

  it("aceptar, rechazar y descartar dejan su registro con quién y cuándo", async () => {
    const accepted = await save(staff, payload())
    await staff("select public.send_quote($1)", [accepted])
    await staff("select public.mark_quote($1, 'accepted', 'Confirmó por WhatsApp')", [accepted])
    const events = (await owner<{ status: string; created_by: string }>("select status, created_by from public.quote_status_events where quote_id = $1 order by created_at", [accepted])).rows
    expect(events.map((e) => e.status)).toEqual(["draft", "sent", "accepted"])
    expect(events.every((e) => e.created_by === STAFF)).toBe(true)

    const draft = await save(staff, payload())
    await expect(staff("select public.discard_quote($1, '')", [draft])).rejects.toThrow(/motivo/)
    await staff("select public.discard_quote($1, 'Se hizo otro')", [draft])
    expect((await quote(draft)).status).toBe("discarded")
    await expect(staff("select public.send_quote($1)", [draft])).rejects.toThrow(/Solo se envía un borrador/)
  })

  it("un enviado vencido se ve vencido al momento y el registro diario lo marca", async () => {
    const id = await save(staff, payload())
    await staff("select public.send_quote($1)", [id])
    // Simula que pasó la fecha (el contenido de un enviado no se toca: se salta el guardián para la prueba).
    await db.exec("alter table public.quotes disable trigger quotes_guard")
    await db.query("update public.quotes set issued_on = issued_on - 10, valid_until = valid_until - 9 where id = $1", [id])
    await db.exec("alter table public.quotes enable trigger quotes_guard")

    expect((await one(owner<{ effective_status: string }>("select effective_status from public.quotes_overview where id = $1", [id]))).effective_status).toBe("expired")
    await expect(staff("select public.mark_quote($1, 'accepted')", [id])).rejects.toThrow(/enviado y vigente/)
    await expect(staff("select public.expire_quotes()")).rejects.toThrow(/permission denied/)
    await service("select public.expire_quotes()")
    expect((await quote(id)).status).toBe("expired")
  })
})

describe("cliente bloqueado y permisos", () => {
  it("un cliente bloqueado no recibe presupuestos", async () => {
    await expect(save(staff, payload({ customer_id: ids.blocked }))).rejects.toThrow(/bloqueado/)

    // Si lo bloquean después de hacer el borrador, no se puede enviar.
    const customer = (await one(owner<{ id: string }>("insert into public.customers (kind, first_name, legal_name) values ('company', 'Hotel', 'Hotel C.A.') returning id"))).id
    const id = await save(staff, payload({ customer_id: customer }))
    expect((await quote(id)).customer_name).toBe("Hotel")
    await owner("select public.block_customer($1, 'Deuda')", [customer])
    await expect(staff("select public.send_quote($1)", [id])).rejects.toThrow(/bloqueado/)
  })

  it("staff ve todos los presupuestos y nadie escribe directo en las tablas", async () => {
    await save(owner, payload())
    const all = (await owner("select id from public.quotes")).rows.length
    expect((await staff("select id from public.quotes")).rows).toHaveLength(all)
    await expect(staff("insert into public.quotes (number, code, valid_until) values (1, 'X', current_date)")).rejects.toThrow(/permission denied/)
    await expect(staff("select public.quote_apply(gen_random_uuid(), '{}')")).rejects.toThrow(/permission denied/)
  })
})
