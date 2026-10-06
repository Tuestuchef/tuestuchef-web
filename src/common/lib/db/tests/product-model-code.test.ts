import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
let categoryId: string

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })
  categoryId = (await owner<{ id: string }>("insert into public.product_categories (name, code) values ('Estuches', 'EST') returning id")).rows[0].id
})

describe("código del modelo", () => {
  it("es opcional y acepta 1 a 6 letras o números en mayúscula", async () => {
    await owner(`insert into public.products (category_id, name) values ('${categoryId}', 'Sin código')`)
    const row = (
      await owner<{ model_code: string }>(
        `insert into public.products (category_id, name, model_code) values ('${categoryId}', 'Estuche Maxi', 'MAXI') returning model_code`
      )
    ).rows[0]
    expect(row.model_code).toBe("MAXI")
  })

  it("rechaza minúsculas, símbolos o más de 6 caracteres", async () => {
    for (const code of ["maxi", "MA-XI", "MANGACORTA", ""]) {
      await expect(
        owner(`insert into public.products (category_id, name, model_code) values ('${categoryId}', 'X', '${code}')`)
      ).rejects.toThrow(/products_model_code_format/)
    }
  })

  it("staff sigue sin poder crear ni editar productos", async () => {
    await expect(
      staff(`insert into public.products (category_id, name, model_code) values ('${categoryId}', 'X', 'ST')`)
    ).rejects.toThrow()
    const updated = await staff(`update public.products set model_code = 'ST' where name = 'Estuche Maxi' returning id`)
    expect(updated.rows).toHaveLength(0)
  })
})
