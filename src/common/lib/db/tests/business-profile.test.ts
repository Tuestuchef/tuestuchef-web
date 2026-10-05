import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>

const profile = async () =>
  (await owner<{ email: string | null; phone: string | null; updated_by: string | null }>("select * from public.business_profile")).rows[0]

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })
})

describe("datos del negocio", () => {
  it("hay una sola fila, con el correo de contacto inicial, y todos la leen", async () => {
    const rows = (await staff<{ email: string }>("select email from public.business_profile")).rows
    expect(rows).toEqual([{ email: "contacto@tuestuchef.com" }])
    await expect(owner("insert into public.business_profile (id) values (false)")).rejects.toThrow(/permission denied/)
  })

  it("owner y admin editan y queda quién lo cambió", async () => {
    await admin("update public.business_profile set phone = '+584141234567', instagram = 'tuestuchef', tax_id = 'J123456789'")
    const row = await profile()
    expect(row).toMatchObject({ phone: "+584141234567", updated_by: ADMIN })
  })

  it("staff no edita, ni owner sin 2FA", async () => {
    await staff("update public.business_profile set email = 'x@y.com'")
    await asUser(db, OWNER, { aal: "aal1" })("update public.business_profile set email = 'x@y.com'")
    expect((await profile()).email).toBe("contacto@tuestuchef.com")
  })

  it("guarda nombre comercial, razón social, web e imagen de encabezado", async () => {
    expect((await owner<{ trade_name: string }>("select trade_name from public.business_profile")).rows[0].trade_name).toBe("Tuestuchef")
    await owner(
      "update public.business_profile set legal_name = 'Tuestuchef C.A.', website = 'https://tuestuchef.com', header_image_path = 'brand/header/0b6e2f2c-6f43-4bb4-9b54-1f5a8d3c9e10.png'"
    )
    await expect(owner("update public.business_profile set website = 'tuestuchef.com'")).rejects.toThrow(/check/)
    await expect(owner("update public.business_profile set header_image_path = 'https://cdn/x.png'")).rejects.toThrow(/check/)
  })

  it("valida los formatos", async () => {
    await expect(owner("update public.business_profile set email = 'no-es-correo'")).rejects.toThrow(/check/)
    await expect(owner("update public.business_profile set phone = '0414-1234567'")).rejects.toThrow(/check/)
    await expect(owner("update public.business_profile set instagram = '@Tuestuchef'")).rejects.toThrow(/check/)
    await expect(owner("update public.business_profile set tax_id = 'J-12345678-9'")).rejects.toThrow(/check/)
    await owner("update public.business_profile set email = null, phone = null")
    expect(await profile()).toMatchObject({ email: null, phone: null })
  })
})
