import { beforeAll, describe, expect, it } from "vitest"

import {
  asUser,
  createTestDb,
  createUser,
  TEST_USERS,
  type TestDb,
} from "@/common/lib/db/tests/db-test.util"

const { OWNER, ADMIN, STAFF } = TEST_USERS
const OTHER_STAFF = "00000000-0000-4000-8000-000000000004"

let db: TestDb
let owner: ReturnType<typeof asUser>
let admin: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
let otherStaff: ReturnType<typeof asUser>
let anon: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

type Line =
  | { variant: string; quantity: number; cost: number; category?: string }
  | { concept: string; quantity: number; cost: number; category: string }
type Payment = { account: string; amount: number; rate?: "bcv_usd" | "parallel" | "none" }

const buy = (
  as: ReturnType<typeof asUser>,
  lines: Line[],
  options: { payments?: Payment[]; dueDate?: string; occurredAt?: string } = {}
) =>
  as<{ id: string }>(
    `select public.create_purchase(
       p_supplier_id => $1, p_items => $2::jsonb, p_payments => $3::jsonb,
       p_due_date => $4::date, p_occurred_at => $5::timestamptz
     ) as id`,
    [
      ids.supplier,
      JSON.stringify(
        lines.map((l) =>
          "variant" in l
            ? { line_type: "inventory", variant_id: ids[l.variant], quantity: l.quantity, unit_cost_usd: l.cost, category_id: ids[l.category ?? "cost"] }
            : { line_type: "concept", description: l.concept, quantity: l.quantity, unit_cost_usd: l.cost, category_id: ids[l.category] }
        )
      ),
      JSON.stringify((options.payments ?? []).map((p) => ({ account_id: ids[p.account], amount: p.amount, rate_kind: p.rate ?? "none" }))),
      options.dueDate ?? null,
      options.occurredAt ?? null,
    ]
  ).then((r) => r.rows[0].id)

const summary = (purchase: string) =>
  owner<{ total_usd: string; paid_usd: string; balance_usd: string; payment_status: string; paid_usdt: string }>(
    "select * from public.purchases_summary where purchase_id = $1",
    [purchase]
  ).then((r) => r.rows[0])

const stock = (variant: string) =>
  owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]]).then((r) =>
    Number(r.rows[0]?.quantity ?? 0)
  )

const balance = (account: string) =>
  owner<{ balance: string }>("select balance from public.account_balances where account_id = $1", [ids[account]]).then((r) =>
    Number(r.rows[0].balance)
  )

const today = () => db.query<{ d: string }>("select public.caracas_today()::text as d").then((r) => r.rows[0].d)

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  await createUser(db, { id: OTHER_STAFF, email: "staff2@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })
  otherStaff = asUser(db, OTHER_STAFF, { aal: "aal1" })
  anon = asUser(db, null)

  // Tasas de hoy: BCV 40, Binance 50.
  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")

  const accounts = await owner<{ id: string; name: string }>(
    `insert into public.accounts (name, currency, kind) values
       ('Banco', 'VES', 'bank'), ('Efectivo USD', 'USD', 'cash'), ('Binance', 'USDT', 'crypto_wallet')
     returning id, name`
  )
  for (const a of accounts.rows) ids[{ Banco: "bank", "Efectivo USD": "cash", Binance: "binance" }[a.name]!] = a.id

  const cats = await owner<{ id: string; type: string }>(
    `insert into public.movement_categories (name, type) values
       ('Telas', 'cost'), ('Alquiler', 'operating_expense'), ('Máquinas', 'reinvestment'), ('Sueldos', 'salary')
     returning id, type`
  )
  for (const c of cats.rows) ids[{ cost: "cost", operating_expense: "rent", reinvestment: "reinvest", salary: "salary" }[c.type]!] = c.id

  ids.supplier = (await owner<{ id: string }>("insert into public.suppliers (name) values ('Textiles Caracas') returning id")).rows[0].id

  const category = (await owner<{ id: string }>("insert into public.product_categories (name, code) values ('Telas', 'TEL') returning id")).rows[0].id
  const fabric = (
    await owner<{ id: string }>(
      "insert into public.products (category_id, name, kind, unit, fulfillment_type) values ($1, 'Tela antifluido', 'raw_material', 'meter', 'stock') returning id",
      [category]
    )
  ).rows[0].id
  ids.fabric = (await owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'TEL-1') returning id", [fabric])).rows[0].id

  const apron = (
    await owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Delantal', 'stock') returning id", [category])
  ).rows[0].id
  ids.apron = (await owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'DEL-1') returning id", [apron])).rows[0].id

  // Para probar que la materia prima no se vende.
  ids.cashMethod = (
    await owner<{ id: string }>(
      "insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id",
      [ids.cash]
    )
  ).rows[0].id
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 5)", [fabric, ids.cashMethod])

  // Saldo inicial en cada cuenta para poder pagar.
  const income = (await owner<{ id: string }>("select id from public.movement_categories where is_system and type = 'sales'")).rows[0].id
  await owner(
    `insert into public.ledger_entries (account_id, entry_type, category_id, amount) values
       ($1, 'income', $4, 100000), ($2, 'income', $4, 1000), ($3, 'income', $4, 1000)`,
    [ids.bank, ids.cash, ids.binance, income]
  )
})

describe("proveedores: RLS", () => {
  it("todo el equipo ve y crea proveedores; solo owner y admin los editan", async () => {
    const created = await staff<{ id: string }>("insert into public.suppliers (name) values ('Botones El Rey') returning id")
    expect(created.rows[0].id).toBeTruthy()
    const updated = await staff("update public.suppliers set notes = 'x' where id = $1 returning id", [created.rows[0].id])
    expect(updated.rows).toHaveLength(0)
    await admin("update public.suppliers set notes = 'Crédito a 15 días' where id = $1", [created.rows[0].id])
  })

  it("nadie borra proveedores y anon no los ve", async () => {
    await expect(owner("delete from public.suppliers where id = $1", [ids.supplier])).rejects.toThrow(/permission denied/)
    await expect(anon("select * from public.suppliers")).rejects.toThrow(/permission denied/)
  })
})

describe("compras: inmutabilidad y permisos", () => {
  it("nadie inserta compras ni pagos directo: solo con las funciones", async () => {
    await expect(
      owner(
        `insert into public.purchases (supplier_id, total_usd, bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate)
         values ($1, 1, 1, 1, 1, 1)`,
        [ids.supplier]
      )
    ).rejects.toThrow(/permission denied/)
    await expect(
      owner(`insert into public.ledger_entries (account_id, entry_type, category_id, amount) values ($1, 'purchase_payment', $2, -10)`, [
        ids.cash,
        ids.cost,
      ])
    ).rejects.toThrow(/módulo de compras/)
  })

  it("compras, líneas y pagos no se editan ni se borran", async () => {
    const purchase = await buy(owner, [{ variant: "fabric", quantity: 1, cost: 2 }], { payments: [{ account: "cash", amount: 2 }] })
    await expect(db.query("update public.purchases set notes = 'x' where id = $1", [purchase])).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.purchase_items where purchase_id = $1", [purchase])).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.purchase_payments where purchase_id = $1", [purchase])).rejects.toThrow(/no se editan/)
  })

  it("staff ve solo sus compras; nunca cuentas por pagar ni por cobrar", async () => {
    const mine = await buy(staff, [{ variant: "fabric", quantity: 1, cost: 3 }], { payments: [{ account: "cash", amount: 3 }] })
    await buy(owner, [{ variant: "fabric", quantity: 1, cost: 4 }], { dueDate: await today() })

    const seen = await staff<{ id: string }>("select id from public.purchases")
    expect(seen.rows.map((r) => r.id)).toEqual([mine])
    expect((await otherStaff("select id from public.purchases")).rows).toHaveLength(0)
    const items = await staff<{ purchase_id: string }>("select purchase_id from public.purchase_items")
    expect(new Set(items.rows.map((r) => r.purchase_id))).toEqual(new Set([mine]))
    expect((await staff("select * from public.payables")).rows).toHaveLength(0)
    expect((await staff("select * from public.receivables")).rows).toHaveLength(0)
    expect((await owner("select * from public.payables")).rows.length).toBeGreaterThan(0)
  })
})

describe("compras de contado", () => {
  it("staff compra pagando completo: entra stock con costo en USDT y sale el dinero del libro", async () => {
    const before = await stock("fabric")
    const cashBefore = await balance("cash")
    const purchase = await buy(staff, [{ variant: "fabric", quantity: 10, cost: 2.5 }], { payments: [{ account: "cash", amount: 25 }] })

    expect(await stock("fabric")).toBe(before + 10)
    expect(await balance("cash")).toBe(cashBefore - 25)
    expect((await summary(purchase)).payment_status).toBe("paid")

    const entry = await owner<{ entry_type: string; amount: string; category_id: string; created_by: string }>(
      `select l.entry_type, l.amount, l.category_id, l.created_by
       from public.purchase_payment_entries e join public.ledger_entries l on l.id = e.ledger_entry_id
       where e.purchase_id = $1`,
      [purchase]
    )
    expect(entry.rows).toEqual([{ entry_type: "purchase_payment", amount: "-25.00", category_id: ids.cost, created_by: STAFF }])
  })

  it("staff no compra a crédito ni deja saldo", async () => {
    await expect(buy(staff, [{ variant: "fabric", quantity: 1, cost: 5 }], { dueDate: await today() })).rejects.toThrow(/crédito son de owner y admin/)
    await expect(
      buy(staff, [{ variant: "fabric", quantity: 2, cost: 5 }], { payments: [{ account: "cash", amount: 5 }] })
    ).rejects.toThrow(/pagadas completas/)
  })

  it("staff solo usa categorías permitidas", async () => {
    await expect(
      buy(staff, [{ concept: "Máquina de coser", quantity: 1, cost: 10, category: "reinvest" }], { payments: [{ account: "cash", amount: 10 }] })
    ).rejects.toThrow(/Staff no puede usar/)
    await expect(
      buy(owner, [{ concept: "Sueldo", quantity: 1, cost: 10, category: "salary" }], { payments: [{ account: "cash", amount: 10 }] })
    ).rejects.toThrow(/no se usa en compras/)
  })

  it("las compras de stock solo entran desde el módulo de compras", async () => {
    await expect(
      owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'purchase', 1, 1)", [ids.fabric])
    ).rejects.toThrow(/módulo de compras/)
  })
})

describe("líneas de concepto y reparto por categoría", () => {
  it("un pago se reparte en el libro según la categoría de cada línea; los conceptos no mueven stock", async () => {
    const before = await stock("fabric")
    // 30 de tela (costo) + 10 de alquiler (gasto operativo), pagado 40 en efectivo.
    const purchase = await buy(
      owner,
      [
        { variant: "fabric", quantity: 10, cost: 3 },
        { concept: "Alquiler del taller", quantity: 1, cost: 10, category: "rent" },
      ],
      { payments: [{ account: "cash", amount: 40 }] }
    )
    expect(await stock("fabric")).toBe(before + 10)

    const entries = await owner<{ category_id: string; amount: string }>(
      `select l.category_id, l.amount from public.purchase_payment_entries e
       join public.ledger_entries l on l.id = e.ledger_entry_id where e.purchase_id = $1 order by l.amount`,
      [purchase]
    )
    expect(entries.rows).toEqual([
      { category_id: ids.cost, amount: "-30.00" },
      { category_id: ids.rent, amount: "-10.00" },
    ])
  })

  it("el reparto suma exactamente el monto pagado aunque haya redondeo", async () => {
    // Tres líneas iguales: 100 Bs no se dividen exacto en tercios.
    const purchase = await buy(owner, [
      { concept: "A", quantity: 1, cost: 1, category: "cost" },
      { concept: "B", quantity: 1, cost: 1, category: "rent" },
      { concept: "C", quantity: 1, cost: 1, category: "reinvest" },
    ])
    await admin("select public.add_purchase_payment($1, $2, 120, 'bcv_usd')", [purchase, ids.bank])
    const sum = await owner<{ total: string }>(
      `select sum(l.amount) as total from public.purchase_payment_entries e
       join public.ledger_entries l on l.id = e.ledger_entry_id where e.purchase_id = $1`,
      [purchase]
    )
    expect(Number(sum.rows[0].total)).toBe(-120)
  })
})

describe("compras a crédito y pagos en Bs", () => {
  it("queda en cuentas por pagar con su vencimiento", async () => {
    const date = await today()
    const purchase = await buy(admin, [{ variant: "fabric", quantity: 20, cost: 5 }], { dueDate: date })
    const payable = await owner<{ balance_usd: string; due_date: string; supplier_name: string }>(
      "select balance_usd, due_date::text, supplier_name from public.payables where purchase_id = $1",
      [purchase]
    )
    expect(payable.rows[0]).toMatchObject({ balance_usd: "100.000000", due_date: date, supplier_name: "Textiles Caracas" })
  })

  it("en Bs se elige la tasa: BCV cubre más saldo en USD que su valor real; paralelo cubre lo mismo", async () => {
    const purchase = await buy(admin, [{ variant: "fabric", quantity: 10, cost: 10 }], { dueDate: await today() })

    // 2.000 Bs a BCV 40 = 50 USD de saldo; valor real 2.000 ÷ Binance 50 = 40 USDT.
    await admin("select public.add_purchase_payment($1, $2, 2000, 'bcv_usd')", [purchase, ids.bank])
    // 2.500 Bs a paralelo 50 = 50 USD de saldo; valor real 50 USDT.
    await admin("select public.add_purchase_payment($1, $2, 2500, 'parallel')", [purchase, ids.bank])

    const payments = await owner<{ rate_kind: string; applied_rate: string; usd_amount: string; usdt_value: string }>(
      "select rate_kind, applied_rate, usd_amount, usdt_value from public.purchase_payments where purchase_id = $1 order by created_at",
      [purchase]
    )
    expect(payments.rows.map((p) => [p.rate_kind, Number(p.applied_rate), Number(p.usd_amount), Number(p.usdt_value)])).toEqual([
      ["bcv_usd", 40, 50, 40],
      ["parallel", 50, 50, 50],
    ])
    expect((await summary(purchase)).payment_status).toBe("paid")
  })

  it("un pago en Bs exige elegir la tasa", async () => {
    const purchase = await buy(admin, [{ variant: "fabric", quantity: 1, cost: 10 }], { dueDate: await today() })
    await expect(admin("select public.add_purchase_payment($1, $2, 100, 'none')", [purchase, ids.bank])).rejects.toThrow(/BCV o paralelo/)
  })

  it("no se paga más que el saldo y staff no hace abonos", async () => {
    const purchase = await buy(admin, [{ variant: "fabric", quantity: 1, cost: 10 }], { dueDate: await today() })
    await expect(admin("select public.add_purchase_payment($1, $2, 11)", [purchase, ids.cash])).rejects.toThrow(/supera el saldo/)
    await expect(staff("select public.add_purchase_payment($1, $2, 5)", [purchase, ids.cash])).rejects.toThrow(/Solo owner y admin/)
  })

  it("los pagos de compra no se revierten sueltos", async () => {
    const purchase = await buy(owner, [{ variant: "fabric", quantity: 1, cost: 1 }], { payments: [{ account: "cash", amount: 1 }] })
    const entry = await owner<{ ledger_entry_id: string }>(
      "select ledger_entry_id from public.purchase_payment_entries where purchase_id = $1",
      [purchase]
    )
    await expect(
      owner("insert into public.ledger_entries (reverses_entry_id, description) values ($1, 'error')", [entry.rows[0].ledger_entry_id])
    ).rejects.toThrow(/anulando la compra/)
  })
})

describe("anulación", () => {
  it("revierte exactamente el dinero y el stock", async () => {
    const stockBefore = await stock("fabric")
    const cashBefore = await balance("cash")
    const purchase = await buy(owner, [{ variant: "fabric", quantity: 7, cost: 2 }], { payments: [{ account: "cash", amount: 14 }] })
    await expect(staff("select public.void_purchase($1, 'error')", [purchase])).rejects.toThrow(/Solo owner y admin/)

    await admin("select public.void_purchase($1, 'Factura duplicada')", [purchase])
    expect(await stock("fabric")).toBe(stockBefore)
    expect(await balance("cash")).toBe(cashBefore)
    expect((await summary(purchase)).payment_status).toBe("voided")
    await expect(admin("select public.add_purchase_payment($1, $2, 1)", [purchase, ids.cash])).rejects.toThrow(/anulada/)
  })

  it("no se anula si la mercancía ya salió", async () => {
    const purchase = await buy(owner, [{ variant: "apron", quantity: 2, cost: 4 }], { payments: [{ account: "cash", amount: 8 }] })
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, note) values ($1, 'adjustment', -2, 'Dañados')", [ids.apron])
    await expect(owner("select public.void_purchase($1, 'error')", [purchase])).rejects.toThrow(/ya se vendió o se usó/)
  })
})

describe("fechas pasadas", () => {
  it("usa las tasas de esa fecha y queda marcada como retroactiva", async () => {
    const date = (await db.query<{ d: string }>("select (public.caracas_today() - 3)::text as d")).rows[0].d
    await owner("insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values ($1, 30, 33, 35)", [date])
    const purchase = await buy(admin, [{ variant: "fabric", quantity: 1, cost: 10 }], {
      occurredAt: `${date}T12:00:00-04:00`,
      payments: [{ account: "bank", amount: 300, rate: "bcv_usd" }],
    })
    const row = await owner<{ is_backdated: boolean; bcv_usd_rate: string }>(
      "select is_backdated, bcv_usd_rate from public.purchases where id = $1",
      [purchase]
    )
    expect(row.rows[0]).toMatchObject({ is_backdated: true, bcv_usd_rate: "30.00000000" })
    expect((await summary(purchase)).payment_status).toBe("paid")
  })

  it("staff no pasa del límite de días", async () => {
    const date = (await db.query<{ d: string }>("select (public.caracas_today() - 10)::text as d")).rows[0].d
    await owner("insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt) values ($1, 20, 22, 25)", [date])
    await expect(
      buy(staff, [{ variant: "fabric", quantity: 1, cost: 1 }], {
        occurredAt: `${date}T12:00:00-04:00`,
        payments: [{ account: "cash", amount: 1 }],
      })
    ).rejects.toThrow(/hasta 7 días atrás/)
  })
})

describe("materia prima y cuentas por cobrar", () => {
  it("la materia prima no se vende", async () => {
    await expect(
      owner(
        `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup',
           p_items => $2::jsonb)`,
        [ids.cashMethod, JSON.stringify([{ variant_id: ids.fabric, quantity: 1, source: "stock" }])]
      )
    ).rejects.toThrow(/materia prima: no se vende/)
  })

  it("por cobrar sale de las ventas con saldo, sin duplicar datos", async () => {
    const category = (await owner<{ id: string }>("select category_id as id from public.products where name = 'Delantal'")).rows[0].id
    const product = (
      await owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Gorro', 'made_to_order') returning id", [category])
    ).rows[0].id
    const variant = (await owner<{ id: string }>("insert into public.product_variants (product_id, sku) values ($1, 'GOR-1') returning id", [product])).rows[0].id
    await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 12)", [product, ids.cashMethod])
    const customer = (await owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Ana', '+584141234567') returning id")).rows[0].id

    const sale = (
      await staff<{ id: string }>(
        `select public.create_sale(p_channel => 'whatsapp', p_price_method_id => $1, p_delivery_method => 'pickup',
           p_items => $2::jsonb, p_payments => $3::jsonb, p_customer_id => $4) as id`,
        [
          ids.cashMethod,
          JSON.stringify([{ variant_id: variant, quantity: 2, source: "made_to_order" }]),
          JSON.stringify([{ payment_method_id: ids.cashMethod, amount: 10 }]),
          customer,
        ]
      )
    ).rows[0].id

    const row = await owner<{ customer_name: string; balance_usd: string; days_outstanding: number }>(
      "select customer_name, balance_usd, days_outstanding from public.receivables where sale_id = $1",
      [sale]
    )
    expect(row.rows[0]).toMatchObject({ customer_name: "Ana", balance_usd: "14.000000", days_outstanding: 0 })
  })
})
