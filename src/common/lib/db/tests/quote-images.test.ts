import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]
const uuid = () => crypto.randomUUID()
const uploadPath = (ext = "jpg") => `quotes/images/${uuid()}.${ext}`

const payload = (images: unknown) => ({
  customer: { name: "Hotel Ávila" },
  currencies: "usd",
  usd_price_method_id: ids.cash,
  items: [{ variant_id: ids.shirt, quantity: 2 }],
  images,
})

const save = (as: ReturnType<typeof asUser>, quoteId: string | null, images: unknown) =>
  one(as<{ id: string }>("select public.save_quote_draft($1, $2::jsonb) as id", [quoteId, JSON.stringify(payload(images))])).then((r) => r.id)

const imagesOf = (quoteId: string) =>
  owner<{ position: number; label: string | null; source: string; bucket: string; path: string }>(
    "select position, label, source, bucket, path from public.quote_images where quote_id = $1 order by position",
    [quoteId]
  ).then((r) => r.rows)

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  const account = await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))
  ids.cash = (
    await one(owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [account.id]))
  ).id
  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  ids.product = (await one(owner<{ id: string }>("insert into public.products (category_id, name) values ($1, 'Filipina manga corta') returning id", [category.id]))).id
  ids.shirt = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'FIL-1') returning id", [ids.product]))).id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 45)", [ids.product, ids.cash])
  ids.photoPath = `products/${ids.product}/${uuid()}.webp`
  ids.photo = (await one(owner<{ id: string }>("insert into public.product_images (product_id, path) values ($1, $2) returning id", [ids.product, ids.photoPath]))).id
})

describe("imágenes del presupuesto", () => {
  it("se guardan con el borrador, en orden y con su nombre; la ruta del catálogo la pone la base", async () => {
    const logo = uploadPath("png")
    ids.quote = await save(staff, null, [
      { source: "product", product_image_id: ids.photo, label: "  Filipina manga corta · Vinotinto  ", path: "products/otra/ruta.jpg" },
      { source: "upload", path: logo, label: "" },
    ])
    expect(await imagesOf(ids.quote)).toEqual([
      { position: 0, label: "Filipina manga corta · Vinotinto", source: "product", bucket: "public", path: ids.photoPath },
      { position: 1, label: null, source: "upload", bucket: "private", path: logo },
    ])
    // Sin "images" en el borrador, no se tocan.
    await one(owner("select public.save_quote_draft($1, $2::jsonb) as id", [ids.quote, JSON.stringify({ ...payload(undefined), images: undefined })]))
    expect(await imagesOf(ids.quote)).toHaveLength(2)
  })

  it("rechaza rutas inventadas, fotos del catálogo que no existen y más de 12", async () => {
    await expect(save(owner, ids.quote, [{ source: "upload", path: "receipts/2026/01/x.jpg" }])).rejects.toThrow(/no es válida/)
    await expect(save(owner, ids.quote, [{ source: "upload", path: "quotes/images/../../x.jpg" }])).rejects.toThrow(/no es válida/)
    await expect(save(owner, ids.quote, [{ source: "product", product_image_id: uuid() }])).rejects.toThrow(/ya no existe/)
    await expect(save(owner, ids.quote, Array.from({ length: 13 }, () => ({ source: "upload", path: uploadPath() })))).rejects.toThrow(/Máximo 12/)
    // Nadie escribe directo.
    await expect(staff("insert into public.quote_images (quote_id, source, bucket, path) values ($1, 'upload', 'private', $2)", [ids.quote, uploadPath()])).rejects.toThrow()
    expect((await staff("select * from public.quote_images where quote_id = $1", [ids.quote])).rows).toHaveLength(2)
  })

  it("enviado ya no cambian; una versión nueva las copia", async () => {
    await owner("select public.send_quote($1)", [ids.quote])
    await expect(save(owner, ids.quote, [])).rejects.toThrow()
    const version = (await one(owner<{ id: string }>("select public.new_quote_version($1) as id", [ids.quote]))).id
    expect((await imagesOf(version)).map((i) => i.source)).toEqual(["product", "upload"])
    // Duplicar también.
    const copy = (await one(owner<{ id: string }>("select public.duplicate_quote($1) as id", [version]))).id
    expect(await imagesOf(copy)).toHaveLength(2)
  })
})
