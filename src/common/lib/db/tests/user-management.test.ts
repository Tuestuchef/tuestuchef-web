import { beforeAll, describe, expect, it } from "vitest"

import {
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS
const OWNER_2 = "00000000-0000-4000-8000-000000000004"
const STAFF_2 = "00000000-0000-4000-8000-000000000005"
const ADMIN_2 = "00000000-0000-4000-8000-000000000006"

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>

async function profile(id: string) {
  const { rows } = await db.query<{ role: string; is_active: boolean; email: string }>(
    "select role, is_active, email from public.profiles where id = $1",
    [id]
  )
  return rows[0]
}

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  await createUser(db, { id: STAFF_2, email: "staff2@t.test", role: "staff" })
  await createUser(db, { id: ADMIN_2, email: "admin2@t.test", role: "admin" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF)
})

describe("perfil", () => {
  it("guarda el correo de Auth y lo sincroniza si cambia", async () => {
    expect((await profile(STAFF)).email).toBe("staff@t.test")
    await db.query("update auth.users set email = 'nuevo@t.test' where id = $1", [STAFF])
    expect((await profile(STAFF)).email).toBe("nuevo@t.test")
  })
})

describe("admin solo gestiona staff", () => {
  it("admin desactiva y reactiva staff", async () => {
    const off = await admin(`update public.profiles set is_active = false where id = '${STAFF_2}'`)
    expect(off.affectedRows).toBe(1)
    expect((await profile(STAFF_2)).is_active).toBe(false)
    await admin(`update public.profiles set is_active = true where id = '${STAFF_2}'`)
    expect((await profile(STAFF_2)).is_active).toBe(true)
  })

  it("admin no asciende a staff", async () => {
    await expect(
      admin(`update public.profiles set role = 'admin' where id = '${STAFF_2}'`)
    ).rejects.toThrow(/row-level security/)
    expect((await profile(STAFF_2)).role).toBe("staff")
  })

  it("admin no toca a otro admin ni al owner", async () => {
    const onAdmin = await admin(`update public.profiles set is_active = false where id = '${ADMIN_2}'`)
    const onOwner = await admin(`update public.profiles set role = 'staff' where id = '${OWNER}'`)
    expect(onAdmin.affectedRows).toBe(0)
    expect(onOwner.affectedRows).toBe(0)
    expect((await profile(ADMIN_2)).is_active).toBe(true)
    expect((await profile(OWNER)).role).toBe("owner")
  })
})

describe("owner gestiona todos los roles", () => {
  it("owner asciende staff a admin y lo regresa", async () => {
    await owner(`update public.profiles set role = 'admin' where id = '${STAFF_2}'`)
    expect((await profile(STAFF_2)).role).toBe("admin")
    await owner(`update public.profiles set role = 'staff' where id = '${STAFF_2}'`)
    expect((await profile(STAFF_2)).role).toBe("staff")
  })

  it("owner asigna el rol owner", async () => {
    await createUser(db, { id: OWNER_2, email: "owner2@t.test", role: "staff" })
    await owner(`update public.profiles set role = 'owner' where id = '${OWNER_2}'`)
    expect((await profile(OWNER_2)).role).toBe("owner")
  })

  it("owner quita el rol owner a otro owner mientras quede uno activo", async () => {
    await owner(`update public.profiles set role = 'admin' where id = '${OWNER_2}'`)
    expect((await profile(OWNER_2)).role).toBe("admin")
  })
})

describe("nadie se cambia a sí mismo", () => {
  it.each([
    ["owner", () => owner(`update public.profiles set role = 'admin' where id = '${OWNER}'`)],
    ["owner (desactivarse)", () => owner(`update public.profiles set is_active = false where id = '${OWNER}'`)],
    ["admin", () => admin(`update public.profiles set role = 'owner' where id = '${ADMIN}'`)],
    ["staff", () => staff(`update public.profiles set role = 'owner' where id = '${STAFF}'`)],
  ])("%s", async (_, run) => {
    await expect(run()).rejects.toThrow(/propio rol/)
  })

  it("cada quien sí edita su nombre", async () => {
    const { affectedRows } = await staff(`update public.profiles set full_name = 'Nuevo nombre' where id = '${STAFF}'`)
    expect(affectedRows).toBe(1)
  })

  it("staff no toca a otros", async () => {
    const { affectedRows } = await staff(`update public.profiles set is_active = false where id = '${STAFF_2}'`)
    expect(affectedRows).toBe(0)
  })
})

describe("siempre queda un owner activo", () => {
  it("no se puede degradar ni desactivar al último owner (ni como sistema)", async () => {
    await expect(db.query(`update public.profiles set role = 'admin' where id = '${OWNER}'`)).rejects.toThrow(
      /al menos un owner activo/
    )
    await expect(db.query(`update public.profiles set is_active = false where id = '${OWNER}'`)).rejects.toThrow(
      /al menos un owner activo/
    )
  })

  it("con dos owners, uno puede desactivar al otro", async () => {
    await owner(`update public.profiles set role = 'owner' where id = '${OWNER_2}'`)
    await owner(`update public.profiles set is_active = false where id = '${OWNER_2}'`)
    expect((await profile(OWNER_2)).is_active).toBe(false)
  })
})

describe("usuarios no se borran", () => {
  it("borrar un perfil o su usuario de Auth falla", async () => {
    await expect(db.query(`delete from public.profiles where id = '${STAFF_2}'`)).rejects.toThrow(/no se borran/)
    await expect(db.query(`delete from auth.users where id = '${STAFF_2}'`)).rejects.toThrow(/no se borran/)
  })
})

describe("bitácora role_changes", () => {
  it("registra rol anterior, nuevo, quién y cuándo", async () => {
    const { rows } = await owner<{
      previous_role: string
      new_role: string
      changed_by: string
      changed_at: string
    }>(
      `select previous_role, new_role, changed_by, changed_at from public.role_changes
       where profile_id = '${STAFF_2}' and previous_role <> new_role order by changed_at`
    )
    expect(rows.map((r) => `${r.previous_role}>${r.new_role}`)).toEqual(["staff>admin", "admin>staff"])
    expect(rows.every((r) => r.changed_by === OWNER && r.changed_at)).toBe(true)
  })

  it("registra desactivaciones con quién las hizo", async () => {
    const { rows } = await admin<{ changed_by: string }>(
      `select changed_by from public.role_changes
       where profile_id = '${STAFF_2}' and previous_is_active and not new_is_active`
    )
    expect(rows).toEqual([{ changed_by: ADMIN }])
  })

  it("staff no la ve", async () => {
    const { rows } = await staff("select * from public.role_changes")
    expect(rows).toHaveLength(0)
  })

  it("nadie la edita ni la escribe a mano", async () => {
    await expect(owner("update public.role_changes set new_role = 'owner'")).rejects.toThrow(/permission denied/)
    await expect(owner("delete from public.role_changes")).rejects.toThrow(/permission denied/)
    await expect(
      owner(
        `insert into public.role_changes (profile_id, previous_role, new_role, previous_is_active, new_is_active) values ('${STAFF}', 'staff', 'owner', true, true)`
      )
    ).rejects.toThrow(/permission denied/)
    await expect(db.query("update public.role_changes set new_role = 'owner'")).rejects.toThrow(/no se editan/)
  })
})

describe("usuario desactivado", () => {
  it("pierde todo acceso por RLS", async () => {
    await owner(`update public.profiles set is_active = false where id = '${STAFF}'`)
    const { rows } = await staff<{ ok: boolean }>(
      "select public.has_role(array['owner','admin','staff']::public.app_role[]) ok"
    )
    expect(rows[0].ok).toBe(false)
  })

  it("el hook de Auth le niega el token; a un activo lo deja pasar", async () => {
    const hook = (id: string) =>
      db.query<{ result: { error?: { http_code: number }; user_id?: string } }>(
        "select public.custom_access_token_hook($1::jsonb) result",
        [{ user_id: id, claims: { sub: id } }]
      )
    const denied = await hook(STAFF)
    expect(denied.rows[0].result.error?.http_code).toBe(403)
    const allowed = await hook(ADMIN)
    expect(allowed.rows[0].result.user_id).toBe(ADMIN)
  })

  it("el hook no se puede llamar desde la API", async () => {
    await expect(owner(`select public.custom_access_token_hook('{}'::jsonb)`)).rejects.toThrow(/permission denied/)
  })
})
