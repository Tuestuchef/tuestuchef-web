import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let staff: ReturnType<typeof asUser>

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  staff = asUser(db, STAFF, { aal: "aal1" })
})

describe("clientes empresa", () => {
  it("una empresa solo necesita la razón social (sin teléfono, correo ni Instagram)", async () => {
    const row = (
      await staff<{ kind: string; tax_id: string }>(
        "insert into public.customers (kind, first_name, legal_name, tax_id, contact_person, address) values ('company', 'Litoral', 'Inversiones Litoral C.A.', 'J123456789', 'María Gómez', 'Caracas') returning kind, tax_id"
      )
    ).rows[0]
    expect(row).toEqual({ kind: "company", tax_id: "J123456789" })
  })

  it("una empresa sin razón social no pasa", async () => {
    await expect(staff("insert into public.customers (kind, first_name) values ('company', 'Sin razón')")).rejects.toThrow(
      /customers_company_legal_name/
    )
  })

  it("una persona sigue necesitando un contacto y no lleva campos de empresa", async () => {
    await expect(staff("insert into public.customers (first_name) values ('Ana')")).rejects.toThrow(/customers_contact_required/)
    await expect(
      staff("insert into public.customers (first_name, phone, tax_id) values ('Ana', '+584141111111', 'V12345678')")
    ).rejects.toThrow(/customers_company_fields/)
    await staff("insert into public.customers (first_name, phone, address) values ('Ana', '+584141111111', 'Valencia')")
  })

  it("el RIF es único y con formato", async () => {
    await expect(
      staff("insert into public.customers (kind, first_name, legal_name, tax_id) values ('company', 'Otra', 'Otra C.A.', 'J123456789')")
    ).rejects.toThrow(/unique|duplicate/)
    await expect(
      staff("insert into public.customers (kind, first_name, legal_name, tax_id) values ('company', 'Otra', 'Otra C.A.', 'J-12345678-9')")
    ).rejects.toThrow(/check/)
  })
})
