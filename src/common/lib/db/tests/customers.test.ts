import { beforeAll, describe, expect, it } from "vitest"

import {
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
let anon: ReturnType<typeof asUser>

const create = (as: ReturnType<typeof asUser>, values: Record<string, string | null>) => {
  const columns = Object.keys(values)
  return as<{ id: string }>(
    `insert into public.customers (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(values)
  ).then((r) => r.rows[0].id)
}

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })
  anon = asUser(db, null)
})

describe("customers: datos obligatorios y formato", () => {
  it("staff crea un cliente con nombre y un medio de contacto", async () => {
    const id = await create(staff, { first_name: "Ana", phone: "+584141234567" })
    expect(id).toBeTruthy()
  })

  it("exige al menos un medio de contacto", async () => {
    await expect(create(staff, { first_name: "Sin contacto" })).rejects.toThrow(/customers_contact_required/)
  })

  it("acepta solo Instagram como contacto", async () => {
    expect(await create(staff, { first_name: "Luis", instagram: "luis.chef" })).toBeTruthy()
  })

  it("rechaza datos sin normalizar", async () => {
    await expect(create(staff, { first_name: "X", phone: "0414-1234567" })).rejects.toThrow(/check constraint/)
    await expect(create(staff, { first_name: "X", email: "Mayus@Correo.com" })).rejects.toThrow(/check constraint/)
    await expect(create(staff, { first_name: "X", instagram: "@con_arroba" })).rejects.toThrow(/check constraint/)
  })

  it("teléfono y email son únicos", async () => {
    await create(owner, { first_name: "María", email: "maria@correo.com" })
    await expect(create(staff, { first_name: "Otra", phone: "+584141234567" })).rejects.toThrow(/customers_phone_key/)
    await expect(create(staff, { first_name: "Otra", email: "maria@correo.com" })).rejects.toThrow(/customers_email_key/)
  })

  it("anon no ve ni crea clientes", async () => {
    await expect(anon("select * from public.customers")).rejects.toThrow(/permission denied/)
    await expect(create(anon, { first_name: "Anon", phone: "+584149999999" })).rejects.toThrow(/permission denied/)
  })
})

describe("customers: sin borrados y activación por rol", () => {
  it("nadie borra clientes", async () => {
    const id = await create(owner, { first_name: "Borrable", phone: "+584120000001" })
    await expect(owner("delete from public.customers where id = $1", [id])).rejects.toThrow(/permission denied/)
    await expect(staff("delete from public.customers where id = $1", [id])).rejects.toThrow(/permission denied/)
  })

  it("staff edita datos pero no desactiva", async () => {
    const id = await create(staff, { first_name: "Pedro", phone: "+584120000002" })
    await staff("update public.customers set notes = 'Talla M' where id = $1", [id])
    await expect(staff("update public.customers set is_active = false where id = $1", [id])).rejects.toThrow(
      /Solo owner y admin/
    )
    await admin("update public.customers set is_active = false where id = $1", [id])
    const row = await owner<{ is_active: boolean }>("select is_active from public.customers where id = $1", [id])
    expect(row.rows[0].is_active).toBe(false)
  })

  it("staff no puede marcar has_id_document a mano", async () => {
    const id = await create(staff, { first_name: "Trampa", phone: "+584120000003" })
    await expect(staff("update public.customers set has_id_document = true where id = $1", [id])).rejects.toThrow(
      /permission denied/
    )
  })
})

describe("customer_private: la cédula", () => {
  let id: string

  beforeAll(async () => {
    id = await create(staff, { first_name: "Carla", email: "carla@correo.com" })
  })

  it("staff la registra pero no la lee", async () => {
    await staff("select public.set_customer_id_document($1, $2)", [id, "V12345678"])
    const visible = await staff("select * from public.customer_private where customer_id = $1", [id])
    expect(visible.rows).toHaveLength(0)
    const flag = await staff<{ has_id_document: boolean }>("select has_id_document from public.customers where id = $1", [id])
    expect(flag.rows[0].has_id_document).toBe(true)
  })

  it("owner y admin la leen", async () => {
    const row = await admin<{ id_document: string }>("select id_document from public.customer_private where customer_id = $1", [id])
    expect(row.rows[0].id_document).toBe("V12345678")
  })

  it("staff la corrige sin poder leerla", async () => {
    await staff("select public.set_customer_id_document($1, $2)", [id, "V87654321"])
    const row = await owner<{ id_document: string }>("select id_document from public.customer_private where customer_id = $1", [id])
    expect(row.rows[0].id_document).toBe("V87654321")
  })

  it("staff no la escribe directo en la tabla", async () => {
    await expect(
      staff("insert into public.customer_private (customer_id, id_document) values ($1, 'V11111111')", [id])
    ).rejects.toThrow(/permission denied/)
  })

  it("rechaza formato inválido", async () => {
    await expect(staff("select public.set_customer_id_document($1, $2)", [id, "12.345.678"])).rejects.toThrow(
      /check constraint/
    )
  })

  it("solo owner y admin la quitan", async () => {
    await expect(staff("select public.set_customer_id_document($1, null)", [id])).rejects.toThrow(/Solo owner y admin/)
    await owner("select public.set_customer_id_document($1, null)", [id])
    const flag = await owner<{ has_id_document: boolean }>("select has_id_document from public.customers where id = $1", [id])
    expect(flag.rows[0].has_id_document).toBe(false)
  })

  it("anon no la registra", async () => {
    await expect(anon("select public.set_customer_id_document($1, 'V1234567')", [id])).rejects.toThrow(
      /permission denied/
    )
  })
})
