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
const ids: Record<string, string> = {}

const num = (value: unknown) => Number(value)

async function insertEntry(
  as: ReturnType<typeof asUser>,
  entry: {
    account: string
    type: "income" | "expense"
    category: string
    amount: number
    personId?: string
    receiptPath?: string
  }
) {
  const { rows } = await as<{ id: string; usdt_value: string }>(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount, person_id, receipt_path)
     values ($1, $2, $3, $4, $5, $6)
     returning id, usdt_value`,
    [
      ids[entry.account],
      entry.type,
      ids[entry.category],
      entry.amount,
      entry.personId ?? null,
      entry.receiptPath ?? null,
    ]
  )
  return rows[0]
}

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF)
  anon = asUser(db, null)

  const accounts = await owner<{ id: string; name: string }>(
    `insert into public.accounts (name, currency, kind) values
      ('Banco Bs', 'VES', 'bank'), ('Binance', 'USDT', 'crypto_wallet'),
      ('Caja USD', 'USD', 'cash'), ('Zelle', 'USD', 'zelle')
     returning id, name`
  )
  const categories = await owner<{ id: string; name: string }>(
    `insert into public.movement_categories (name, type) values
      ('Tela', 'cost'), ('Publicidad', 'operating_expense'), ('Sueldos', 'salary'),
      ('Retiros', 'withdrawal'), ('Aportes', 'capital_contribution'),
      ('Reparto', 'profit_distribution'), ('Otros ingresos', 'other_income'),
      ('Reinversión', 'reinvestment'), ('Impuestos', 'tax')
     returning id, name`
  )
  const system = await owner<{ id: string; name: string }>(
    "select id, name from public.movement_categories where is_system"
  )
  for (const row of [...accounts.rows, ...categories.rows, ...system.rows]) {
    ids[row.name] = row.id
  }
})

describe("tasas", () => {
  it("sin tasa registrada, un movimiento se rechaza", async () => {
    await expect(
      insertEntry(staff, { account: "Caja USD", type: "expense", category: "Publicidad", amount: -10 })
    ).rejects.toThrow(/No hay tasa registrada/)
  })

  it("staff registra la de hoy solo si no existe; no otro día", async () => {
    await staff("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (150, 170, 200)")
    await expect(
      staff("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (151, 171, 201)")
    ).rejects.toThrow(/row-level security/)
    await expect(
      staff(
        "insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values (public.caracas_today() - 1, 1, 1, 1)"
      )
    ).rejects.toThrow(/row-level security/)
  })

  it("admin corrige la de hoy y queda vigente", async () => {
    await admin("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (150, 170, 100)")
    const { rows } = await staff<{ binance_usdt: string; usd_usdt: string }>(
      "select binance_usdt, usd_usdt from public.current_exchange_rate"
    )
    expect(num(rows[0].binance_usdt)).toBe(100)
    expect(num(rows[0].usd_usdt)).toBe(1)
  })

  it("una tasa con fecha futura no es la vigente", async () => {
    await owner(
      "insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values (public.caracas_today() + 1, 9, 9, 9)"
    )
    const { rows } = await owner<{ binance_usdt: string }>("select binance_usdt from public.current_exchange_rate")
    expect(num(rows[0].binance_usdt)).toBe(100)
  })
})

describe("RLS: staff y categorías", () => {
  it("staff solo ve sales, other_income, cost y operating_expense", async () => {
    const { rows } = await staff<{ type: string }>("select distinct type from public.movement_categories order by type")
    expect(rows.map((r) => r.type).sort()).toEqual(["cost", "operating_expense", "other_income", "sales"])
  })

  it("staff registra con sus categorías permitidas", async () => {
    await insertEntry(staff, { account: "Binance", type: "income", category: "Ventas", amount: 20 })
    await insertEntry(staff, { account: "Binance", type: "income", category: "Otros ingresos", amount: 5 })
    await insertEntry(staff, { account: "Caja USD", type: "expense", category: "Tela", amount: -8 })
    await insertEntry(staff, { account: "Caja USD", type: "expense", category: "Publicidad", amount: -2 })
  })

  it.each([
    ["Impuestos", "expense", -1],
    ["Reinversión", "expense", -1],
  ] as const)("staff no usa %s", async (category, type, amount) => {
    await expect(insertEntry(staff, { account: "Binance", type, category, amount })).rejects.toThrow(
      /row-level security/
    )
  })

  it.each([
    ["Sueldos", "expense", -1],
    ["Retiros", "expense", -1],
    ["Reparto", "expense", -1],
    ["Aportes", "income", 1],
  ] as const)("staff no usa %s (ni con persona)", async (category, type, amount) => {
    await expect(
      insertEntry(staff, { account: "Binance", type, category, amount, personId: STAFF })
    ).rejects.toThrow(/row-level security/)
  })

  it("staff no crea ni edita categorías", async () => {
    await expect(
      staff("insert into public.movement_categories (name, type) values ('X', 'operating_expense')")
    ).rejects.toThrow(/row-level security/)
    const { affectedRows } = await staff(
      `update public.movement_categories set name = 'Hack' where id = '${ids.Publicidad}'`
    )
    expect(affectedRows).toBe(0)
  })
})

describe("RLS: saldos, traspasos y visibilidad", () => {
  it("anon no ve nada", async () => {
    for (const table of ["accounts", "ledger_entries", "account_balances", "exchange_rates", "movement_categories"]) {
      await expect(anon(`select * from public.${table}`)).rejects.toThrow(/permission denied/)
    }
  })

  it("staff no ve saldos", async () => {
    const { rows } = await staff("select * from public.account_balances")
    expect(rows).toHaveLength(0)
    const all = await owner("select * from public.account_balances")
    expect(all.rows).toHaveLength(4)
  })

  it("staff no ve ni registra traspasos", async () => {
    await owner(`select public.create_account_transfer('${ids["Caja USD"]}', '${ids.Zelle}', 1, 1)`)
    const { rows } = await staff("select * from public.account_transfers")
    expect(rows).toHaveLength(0)
    await expect(
      staff(`select public.create_account_transfer('${ids["Caja USD"]}', '${ids.Zelle}', 1, 1)`)
    ).rejects.toThrow(/row-level security/)
  })

  it("staff solo ve los movimientos que registró", async () => {
    await insertEntry(owner, { account: "Binance", type: "expense", category: "Impuestos", amount: -3 })
    const { rows } = await staff<{ created_by: string }>("select created_by from public.ledger_entries")
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.created_by === STAFF)).toBe(true)
  })

  it("staff no crea cuentas ni métodos de pago", async () => {
    await expect(
      staff("insert into public.accounts (name, currency, kind) values ('X', 'VES', 'bank')")
    ).rejects.toThrow(/row-level security/)
    await expect(
      staff(`insert into public.payment_methods (name, account_id, price_currency) values ('X', '${ids.Binance}', 'USDT')`)
    ).rejects.toThrow(/row-level security/)
  })

  it("created_by no se puede suplantar", async () => {
    const { rows } = await staff<{ created_by: string }>(
      `insert into public.ledger_entries (account_id, entry_type, category_id, amount, created_by)
       values ('${ids.Binance}', 'expense', '${ids.Publicidad}', -1, '${OWNER}') returning created_by`
    )
    expect(rows[0].created_by).toBe(STAFF)
  })
})

describe("inmutabilidad", () => {
  it("nadie edita ni borra movimientos (ni owner)", async () => {
    const entry = await insertEntry(staff, { account: "Binance", type: "expense", category: "Publicidad", amount: -4 })
    await expect(staff(`update public.ledger_entries set amount = -1 where id = '${entry.id}'`)).rejects.toThrow(
      /permission denied/
    )
    await expect(owner(`update public.ledger_entries set amount = -1 where id = '${entry.id}'`)).rejects.toThrow(
      /permission denied/
    )
    await expect(owner(`delete from public.ledger_entries where id = '${entry.id}'`)).rejects.toThrow(
      /permission denied/
    )
  })

  it("ni siquiera un superusuario (trigger)", async () => {
    await expect(db.query("update public.ledger_entries set amount = -1")).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.ledger_entries")).rejects.toThrow(/no se editan/)
    await expect(db.query("truncate public.ledger_entries cascade")).rejects.toThrow(/no se editan/)
    await expect(db.query("update public.exchange_rates set bcv_usd = 1")).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.account_transfers")).rejects.toThrow(/no se editan/)
  })

  it("no se cambia la moneda de una cuenta ni el tipo de una categoría", async () => {
    await expect(owner(`update public.accounts set currency = 'VES' where id = '${ids.Zelle}'`)).rejects.toThrow(
      /permission denied/
    )
    await expect(
      owner(`update public.movement_categories set type = 'withdrawal' where id = '${ids.Tela}'`)
    ).rejects.toThrow(/permission denied/)
  })

  it("categorías de sistema no se editan", async () => {
    await expect(
      owner(`update public.movement_categories set name = 'Otra' where id = '${ids.Ventas}'`)
    ).rejects.toThrow(/del sistema/)
  })

  it("el ámbito no se elige: sale del tipo", async () => {
    await expect(
      owner("insert into public.movement_categories (name, type, scope) values ('X', 'cost', 'personal')")
    ).rejects.toThrow(/non-DEFAULT value/)
    const { rows } = await owner<{ name: string; scope: string }>(
      "select name, scope from public.movement_categories where name in ('Retiros', 'Aportes', 'Reparto', 'Sueldos', 'Tela')"
    )
    const scope = Object.fromEntries(rows.map((r) => [r.name, r.scope]))
    expect(scope).toEqual({
      Retiros: "personal",
      Aportes: "personal",
      Reparto: "personal",
      Sueldos: "business",
      Tela: "business",
    })
  })
})

describe("reversos", () => {
  it("staff no revierte, ni lo suyo", async () => {
    const entry = await insertEntry(staff, { account: "Binance", type: "expense", category: "Publicidad", amount: -6 })
    await expect(staff(`select public.reverse_ledger_entry('${entry.id}', 'error')`)).rejects.toThrow(
      /row-level security/
    )
    ids.staffEntry = entry.id
  })

  it("admin revierte con motivo obligatorio: monto opuesto, mismas tasas y fecha", async () => {
    await expect(admin(`select public.reverse_ledger_entry('${ids.staffEntry}', ' ')`)).rejects.toThrow(/motivo/)
    const { rows } = await admin<{ id: string }>(
      `select public.reverse_ledger_entry('${ids.staffEntry}', 'Monto equivocado') as id`
    )
    const check = await owner<{ amount: string; usdt: string; same: boolean }>(
      `select r.amount, r.usdt_value usdt,
              (r.occurred_at = o.occurred_at and r.binance_rate = o.binance_rate and r.category_id = o.category_id) same
       from public.ledger_entries r join public.ledger_entries o on o.id = r.reverses_entry_id
       where r.id = '${rows[0].id}'`
    )
    expect(num(check.rows[0].amount)).toBe(6)
    expect(num(check.rows[0].usdt)).toBe(6)
    expect(check.rows[0].same).toBe(true)
    await expect(owner(`select public.reverse_ledger_entry('${ids.staffEntry}', 'otra vez')`)).rejects.toThrow(
      /ya fue revertido/
    )
    await expect(owner(`select public.reverse_ledger_entry('${rows[0].id}', 'x')`)).rejects.toThrow(
      /reverso no se puede revertir/
    )
  })

  it("staff ve el reverso que admin hizo de su movimiento, pero no otros reversos", async () => {
    const own = await staff<{ id: string; reverses_entry_id: string | null }>(
      `select id, reverses_entry_id from public.ledger_entries where reverses_entry_id = '${ids.staffEntry}'`
    )
    expect(own.rows).toHaveLength(1)

    const ownerEntry = await insertEntry(owner, { account: "Binance", type: "expense", category: "Tela", amount: -2 })
    await owner(`select public.reverse_ledger_entry('${ownerEntry.id}', 'error del owner')`)
    const others = await staff(`select id from public.ledger_entries where reverses_entry_id = '${ownerEntry.id}'`)
    expect(others.rows).toHaveLength(0)
  })
})

describe("reglas del libro", () => {
  it("usdt_value: Bs ÷ Binance, USD × usd_usdt, ignora lo que mande el cliente", async () => {
    const ves = await insertEntry(owner, { account: "Banco Bs", type: "expense", category: "Tela", amount: -1000 })
    expect(num(ves.usdt_value)).toBe(-10)
    const { rows } = await owner<{ usdt_value: string }>(
      `insert into public.ledger_entries (account_id, entry_type, category_id, amount, usd_usdt_rate, usdt_value)
       values ('${ids.Zelle}', 'income', '${ids["Otros ingresos"]}', 100, 0.95, 99999) returning usdt_value`
    )
    expect(num(rows[0].usdt_value)).toBe(95)
  })

  it("signo, categoría compatible y persona", async () => {
    await expect(
      insertEntry(staff, { account: "Binance", type: "expense", category: "Publicidad", amount: 10 })
    ).rejects.toThrow(/Signo inválido/)
    await expect(
      insertEntry(owner, { account: "Binance", type: "income", category: "Tela", amount: 10 })
    ).rejects.toThrow(/no corresponde/)
    await expect(
      insertEntry(owner, { account: "Caja USD", type: "expense", category: "Retiros", amount: -30 })
    ).rejects.toThrow(/Indica la persona/)
    await insertEntry(owner, {
      account: "Caja USD",
      type: "expense",
      category: "Retiros",
      amount: -30,
      personId: OWNER,
    })
    await expect(
      insertEntry(owner, { account: "Caja USD", type: "expense", category: "Tela", amount: -1, personId: OWNER })
    ).rejects.toThrow(/no lleva persona/)
  })

  it("comprobante: solo la ruta, nunca una URL", async () => {
    await expect(
      insertEntry(staff, {
        account: "Binance",
        type: "expense",
        category: "Publicidad",
        amount: -1,
        receiptPath: "https://x.r2.dev/a.jpg",
      })
    ).rejects.toThrow(/check constraint/)
  })

  it("pagos de venta solo desde el módulo de ventas", async () => {
    await expect(
      owner(
        `insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ('${ids.Binance}', 'sale_payment', '${ids.Ventas}', 10)`
      )
    ).rejects.toThrow(/módulo de ventas/)
  })

  it("uso de categorías por usuario, más usadas primero", async () => {
    const { rows } = await staff<{ category_id: string; uses: string }>("select * from public.my_category_usage()")
    expect(rows[0].category_id).toBe(ids.Publicidad)
    expect(rows.every((r) => [ids.Publicidad, ids.Tela, ids.Ventas, ids["Otros ingresos"]].includes(r.category_id))).toBe(
      true
    )
  })
})

describe("traspasos", () => {
  it("10.000 Bs → 98 USDT: salida, comisión y entrada cuadran", async () => {
    const { rows } = await owner<{ id: string }>(
      `select public.create_account_transfer('${ids["Banco Bs"]}', '${ids.Binance}', 10000, 98, now(), 'Cambio', null, 150, 100, 1) as id`
    )
    const entries = await owner<{ entry_type: string; amount: string; usdt_value: string }>(
      `select entry_type, amount, usdt_value from public.ledger_entries where transfer_id = '${rows[0].id}'`
    )
    const byType = Object.fromEntries(entries.rows.map((r) => [r.entry_type, r]))
    expect(num(byType.transfer_out.amount)).toBe(-9800)
    expect(num(byType.exchange_fee.amount)).toBe(-200)
    expect(num(byType.exchange_fee.usdt_value)).toBe(-2)
    expect(num(byType.transfer_in.amount)).toBe(98)
    expect(num(byType.transfer_out.usdt_value) + num(byType.transfer_in.usdt_value)).toBe(0)
  })

  it("ganancia cambiaria: la comisión sale positiva y el neto es lo real", async () => {
    const { rows } = await owner<{ id: string }>(
      `select public.create_account_transfer('${ids["Caja USD"]}', '${ids.Binance}', 100, 102) as id`
    )
    const entries = await owner<{ entry_type: string; amount: string }>(
      `select entry_type, amount from public.ledger_entries where transfer_id = '${rows[0].id}'`
    )
    const t = Object.fromEntries(entries.rows.map((r) => [r.entry_type, num(r.amount)]))
    expect(t.transfer_out).toBe(-102)
    expect(t.exchange_fee).toBe(2)
  })

  it("sus filas no se insertan ni se revierten sueltas", async () => {
    const transfer = await owner<{ id: string }>("select id from public.account_transfers limit 1")
    await expect(
      owner(
        `insert into public.ledger_entries (account_id, entry_type, amount, transfer_id) values ('${ids.Binance}', 'transfer_in', 5, '${transfer.rows[0].id}')`
      )
    ).rejects.toThrow(/create_account_transfer/)
    const row = await owner<{ id: string }>(
      `select id from public.ledger_entries where transfer_id = '${transfer.rows[0].id}' limit 1`
    )
    await expect(owner(`select public.reverse_ledger_entry('${row.rows[0].id}', 'x')`)).rejects.toThrow(
      /traspaso completo/
    )
  })

  it("anular un traspaso deja los saldos como antes, una sola vez", async () => {
    const balances = async () =>
      Object.fromEntries(
        (await owner<{ account_id: string; balance: string }>("select account_id, balance from public.account_balances")).rows.map(
          (r) => [r.account_id, num(r.balance)]
        )
      )
    const before = await balances()
    const { rows } = await owner<{ id: string }>(
      `select public.create_account_transfer('${ids.Binance}', '${ids["Caja USD"]}', 10, 10) as id`
    )
    await owner(`select public.reverse_account_transfer('${rows[0].id}', 'Cuenta equivocada')`)
    expect(await balances()).toEqual(before)
    await expect(owner(`select public.reverse_account_transfer('${rows[0].id}', 'x')`)).rejects.toThrow(
      /ya fue anulado/
    )
  })
})

describe("seed", () => {
  it("corre completo después de las migraciones", async () => {
    const seeded = await createTestDb({ seed: true })
    const { rows } = await seeded.query<{ p: number; a: number; m: number; owners: number }>(
      `select (select count(*) from public.profiles)::int p,
              (select count(*) from public.accounts)::int a,
              (select count(*) from public.payment_methods)::int m,
              (select count(*) from public.profiles where role = 'owner')::int owners`
    )
    expect(rows[0]).toEqual({ p: 3, a: 4, m: 4, owners: 1 })
  })
})
