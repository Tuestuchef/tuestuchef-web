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
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

const advance = (member: string, account: string, amount: number) =>
  admin<{ id: string }>("select public.register_salary_advance($1, $2, $3) as id", [ids[member], ids[account], amount]).then(
    (r) => r.rows[0].id
  )

const pay = (member: string, account: string, amount: number, settle: string[] | null = null) =>
  admin<{ id: string }>("select public.register_salary_payment($1, $2, $3, '1–15 oct', $4) as id", [
    ids[member],
    ids[account],
    amount,
    settle,
  ]).then((r) => r.rows[0].id)

const pending = (member: string) =>
  owner<{ id: string }>("select id from public.pending_salary_advances where team_member_id = $1", [ids[member]]).then((r) =>
    r.rows.map((x) => x.id)
  )

beforeAll(async () => {
  db = await createTestDb()
  // Los usuarios se crean antes de la migración de equipo en producción; aquí, después:
  // se vinculan con un insert como el backfill de la migración.
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner", name: "Dueña" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff", name: "Staff Uno" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  ids.cash = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Efectivo', 'USD', 'cash') returning id"))).id
  ids.bank = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id"))).id
  const income = (await one(owner<{ id: string }>("select id from public.movement_categories where is_system and type = 'sales'"))).id
  await owner(
    "insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ($1, 'income', $3, 10000), ($2, 'income', $3, 1000000)",
    [ids.cash, ids.bank, income]
  )
  ids.salary = (await one(owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Sueldos', 'salary') returning id"))).id
  ids.withdrawal = (await one(owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Retiros', 'withdrawal') returning id"))).id

  // Costurera sin cuenta en el sistema; dueña vinculada a su usuario.
  ids.seamstress = (await one(owner<{ id: string }>("insert into public.team_members (full_name, job_title) values ('María Costura', 'Costurera') returning id"))).id
  ids.ownerMember = (await one(owner<{ id: string }>("insert into public.team_members (full_name, profile_id) values ('Dueña', $1) returning id", [OWNER]))).id
})

describe("equipo: RLS e inmutabilidad", () => {
  it("staff no ve ni crea personas, sueldos ni pagos", async () => {
    expect((await staff("select * from public.team_members")).rows).toHaveLength(0)
    expect((await staff("select * from public.salary_agreements")).rows).toHaveLength(0)
    expect((await staff("select * from public.payroll_entries")).rows).toHaveLength(0)
    await expect(staff("insert into public.team_members (full_name) values ('X')")).rejects.toThrow(/row-level security/)
    await expect(staff("select public.register_salary_advance($1, $2, 10)", [ids.seamstress, ids.cash])).rejects.toThrow(
      /Solo owner y admin/
    )
  })

  it("staff no registra movimientos de sueldo o retiro", async () => {
    await expect(
      staff("insert into public.ledger_entries (account_id, entry_type, category_id, amount, team_member_id) values ($1, 'expense', $2, -5, $3)", [
        ids.cash,
        ids.salary,
        ids.seamstress,
      ])
    ).rejects.toThrow(/row-level security/)
  })

  it("los sueldos son versionados: no se editan ni se borran", async () => {
    const agreement = (
      await one(admin<{ id: string }>(
        "insert into public.salary_agreements (team_member_id, amount, currency, frequency, effective_from) values ($1, 200, 'USD', 'biweekly', '2026-01-01') returning id",
        [ids.seamstress]
      ))
    ).id
    await expect(db.query("update public.salary_agreements set amount = 1 where id = $1", [agreement])).rejects.toThrow(/no se editan/)
    // Un aumento es un acuerdo nuevo; el vigente es el último con fecha de hoy o anterior.
    await admin(
      "insert into public.salary_agreements (team_member_id, amount, currency, frequency, effective_from) values ($1, 250, 'USD', 'biweekly', public.caracas_today())",
      [ids.seamstress]
    )
    await admin(
      "insert into public.salary_agreements (team_member_id, amount, currency, frequency, effective_from) values ($1, 999, 'USD', 'biweekly', public.caracas_today() + 30)",
      [ids.seamstress]
    )
    const current = await one(owner<{ amount: string }>("select amount from public.current_salary_agreements where team_member_id = $1", [ids.seamstress]))
    expect(Number(current.amount)).toBe(250)
  })

  it("un sueldo a tasa BCV se acuerda en USD o EUR y se paga en Bs", async () => {
    await admin(
      "insert into public.salary_agreements (team_member_id, amount, currency, rate_kind, frequency, effective_from) values ($1, 300, 'VES', 'bcv_eur', 'monthly', public.caracas_today())",
      [ids.seamstress]
    )
    const current = await one(owner<{ amount: string; currency: string; rate_kind: string }>(
      "select amount, currency, rate_kind from public.current_salary_agreements where team_member_id = $1",
      [ids.seamstress]
    ))
    expect(current).toMatchObject({ currency: "VES", rate_kind: "bcv_eur" })
    // A tasa BCV siempre se paga en Bs.
    await expect(
      admin(
        "insert into public.salary_agreements (team_member_id, amount, currency, rate_kind, frequency, effective_from) values ($1, 300, 'USD', 'bcv_usd', 'monthly', public.caracas_today())",
        [ids.seamstress]
      )
    ).rejects.toThrow(/rate_kind_currency/)
  })

  it("nadie borra personas del equipo", async () => {
    await expect(owner("delete from public.team_members where id = $1", [ids.seamstress])).rejects.toThrow(/permission denied/)
  })
})

describe("pagos y adelantos", () => {
  it("un adelanto sale del libro como sueldo de esa persona, aunque no tenga cuenta", async () => {
    const id = await advance("seamstress", "cash", 40)
    const row = await one(owner<{ amount: string; type: string; team_member_id: string; person_id: string | null }>(
      `select l.amount, c.type, l.team_member_id, l.person_id
       from public.payroll_entries p join public.ledger_entries l on l.id = p.ledger_entry_id
       join public.movement_categories c on c.id = l.category_id where p.id = $1`,
      [id]
    ))
    expect(row).toEqual({ amount: "-40.00", type: "salary", team_member_id: ids.seamstress, person_id: null })
    expect(await pending("seamstress")).toEqual([id])
  })

  it("el pago descuenta los adelantos pendientes una sola vez", async () => {
    const second = await advance("seamstress", "cash", 10)
    const payment = await pay("seamstress", "cash", 200)
    expect(await pending("seamstress")).toEqual([])
    const settled = await owner<{ advance_entry_id: string }>(
      "select advance_entry_id from public.payroll_advance_settlements where payment_entry_id = $1",
      [payment]
    )
    expect(settled.rows.map((r) => r.advance_entry_id)).toContain(second)
    await expect(pay("seamstress", "cash", 1, [second])).rejects.toThrow(/ya fue descontado/)
  })

  it("se puede elegir qué adelantos descuenta un pago", async () => {
    const a = await advance("seamstress", "cash", 5)
    const b = await advance("seamstress", "cash", 6)
    await pay("seamstress", "cash", 100, [a])
    expect(await pending("seamstress")).toEqual([b])
  })

  it("en Bs guarda su equivalente en USD con la tasa BCV de la fecha", async () => {
    const id = await advance("seamstress", "bank", 4000)
    const row = await one(owner<{ currency: string; usd_amount: string }>("select currency, usd_amount from public.payroll_entries where id = $1", [id]))
    expect(row).toEqual({ currency: "VES", usd_amount: "100.000000" })
  })

  it("los pagos de nómina no se editan", async () => {
    await expect(db.query("update public.payroll_entries set amount = 1")).rejects.toThrow(/no se editan/)
  })
})

describe("libro y analítica", () => {
  it("person_id y team_member_id se vinculan solos cuando la persona tiene cuenta", async () => {
    const byUser = await one(owner<{ team_member_id: string }>(
      "insert into public.ledger_entries (account_id, entry_type, category_id, amount, person_id) values ($1, 'expense', $2, -30, $3) returning team_member_id",
      [ids.cash, ids.withdrawal, OWNER]
    ))
    expect(byUser.team_member_id).toBe(ids.ownerMember)
    const byMember = await one(owner<{ person_id: string }>(
      "insert into public.ledger_entries (account_id, entry_type, category_id, amount, team_member_id) values ($1, 'expense', $2, -20, $3) returning person_id",
      [ids.cash, ids.withdrawal, ids.ownerMember]
    ))
    expect(byMember.person_id).toBe(OWNER)
  })

  it("sueldos y retiros exigen persona; el resto no la acepta", async () => {
    await expect(
      owner("insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ($1, 'expense', $2, -5)", [ids.cash, ids.salary])
    ).rejects.toThrow(/Indica la persona/)
    const expense = (await one(owner<{ id: string }>("insert into public.movement_categories (name, type) values ('Luz', 'operating_expense') returning id"))).id
    await expect(
      owner("insert into public.ledger_entries (account_id, entry_type, category_id, amount, team_member_id) values ($1, 'expense', $2, -5, $3)", [
        ids.cash,
        expense,
        ids.seamstress,
      ])
    ).rejects.toThrow(/no lleva persona/)
  })

  it("un reverso conserva la persona del equipo", async () => {
    const id = await advance("seamstress", "cash", 7)
    const entry = await one(owner<{ ledger_entry_id: string }>("select ledger_entry_id from public.payroll_entries where id = $1", [id]))
    const reversal = await one(owner<{ team_member_id: string }>(
      "insert into public.ledger_entries (reverses_entry_id, description) values ($1, 'error') returning team_member_id",
      [entry.ledger_entry_id]
    ))
    expect(reversal.team_member_id).toBe(ids.seamstress)
    // Un adelanto revertido ya no queda pendiente.
    expect(await pending("seamstress")).not.toContain(id)
  })

  it("la analítica muestra el nombre del equipo, tenga o no cuenta", async () => {
    const rows = await owner<{ person_name: string; category_type: string }>(
      "select person_name, category_type from public.analytics_ledger_summary(public.caracas_today() - 1, public.caracas_today())"
    )
    const names = new Set(rows.rows.filter((r) => r.person_name).map((r) => r.person_name))
    expect(names).toEqual(new Set(["María Costura", "Dueña"]))
  })
})
