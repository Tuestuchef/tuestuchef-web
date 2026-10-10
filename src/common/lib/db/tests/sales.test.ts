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

type Line = { variant: string; quantity: number; source?: "stock" | "made_to_order" }
type Payment = { method: string; amount: number }
type SaleOptions = {
  priceMethod?: string
  payments?: Payment[]
  customer?: string | null
  deliveryFee?: number
  discount?: { type: "amount" | "percent"; value: number; reason?: string }
}

// Tasas de prueba: BCV USD 40, BCV EUR 44, Binance 50, USD→USDT 1.
const setRate = (bcvUsd: number, bcvEur: number, binance: number) =>
  owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values ($1, $2, $3)", [bcvUsd, bcvEur, binance])

const sell = (as: ReturnType<typeof asUser>, lines: Line[], options: SaleOptions = {}) =>
  as<{ id: string }>(
    `select public.create_sale(
       p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup',
       p_items => $2::jsonb, p_payments => $3::jsonb, p_customer_id => $4,
       p_delivery_fee_usd => $5, p_discount_type => $6::public.discount_type, p_discount_value => $7,
       p_discount_reason => $8
     ) as id`,
    [
      ids[options.priceMethod ?? "cashUsd"],
      JSON.stringify(lines.map((l) => ({ variant_id: ids[l.variant], quantity: l.quantity, source: l.source ?? "stock" }))),
      JSON.stringify((options.payments ?? []).map((p) => ({ payment_method_id: ids[p.method], amount: p.amount }))),
      options.customer ?? null,
      options.deliveryFee ?? 0,
      options.discount?.type ?? null,
      options.discount?.value ?? null,
      options.discount?.reason ?? null,
    ]
  ).then((r) => r.rows[0].id)

const pay = (as: ReturnType<typeof asUser>, sale: string, method: string, amount: number) =>
  as("select public.add_sale_payment($1, $2, $3)", [sale, ids[method], amount])

const summary = (sale: string) =>
  owner<{ total_usd: string; paid_usd: string; balance_usd: string; payment_status: string; collected_usdt: string }>(
    "select * from public.sales_summary where sale_id = $1",
    [sale]
  ).then((r) => r.rows[0])

const stock = (variant: string) =>
  owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]]).then(
    (r) => Number(r.rows[0]?.quantity ?? 0)
  )

const balance = (account: string) =>
  owner<{ balance: string }>("select balance from public.account_balances where account_id = $1", [ids[account]]).then(
    (r) => Number(r.rows[0].balance)
  )

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: ADMIN, email: "admin@t.test", role: "admin" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  admin = asUser(db, ADMIN)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await setRate(40, 44, 50)

  const accounts = await owner<{ id: string; name: string }>(
    `insert into public.accounts (name, currency, kind) values
       ('Banco', 'VES', 'bank'), ('Efectivo USD', 'USD', 'cash'), ('Binance', 'USDT', 'crypto_wallet')
     returning id, name`
  )
  const account = (name: string) => accounts.rows.find((a) => a.name === name)!.id
  ids.bank = account("Banco")
  ids.cash = account("Efectivo USD")
  ids.binance = account("Binance")

  const methods = await owner<{ id: string; name: string }>(
    `insert into public.payment_methods (name, account_id, price_currency, rate_kind) values
       ('Pago móvil', $1, 'USD', 'bcv_usd'),
       ('Transferencia EUR', $1, 'USD', 'bcv_eur'),
       ('Efectivo', $2, 'USD', 'none'),
       ('USDT', $3, 'USD', 'none')
     returning id, name`,
    [ids.bank, ids.cash, ids.binance]
  )
  const method = (name: string) => methods.rows.find((m) => m.name === name)!.id
  ids.pagoMovil = method("Pago móvil")
  ids.eur = method("Transferencia EUR")
  ids.cashUsd = method("Efectivo")
  ids.usdt = method("USDT")

  ids.cat = (await owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id")).rows[0].id
  const product = async (name: string, fulfillment: string) =>
    (
      await owner<{ id: string }>(
        "insert into public.products (category_id, name, fulfillment_type) values ($1, $2, $3) returning id",
        [ids.cat, name, fulfillment]
      )
    ).rows[0].id
  ids.filipina = await product("Filipina", "stock")
  ids.gorro = await product("Gorro bordado", "made_to_order")
  ids.delantal = await product("Delantal", "both")
  ids.sinPrecio = await product("Pantalón", "stock")

  const variant = async (productId: string, sku: string) =>
    (
      await owner<{ id: string }>(
        "insert into public.product_variants (product_id, sku) values ($1, $2) returning id",
        [productId, sku]
      )
    ).rows[0].id
  ids.fil = await variant(ids.filipina, "FIL-1")
  ids.gor = await variant(ids.gorro, "GOR-1")
  ids.del = await variant(ids.delantal, "DEL-1")
  ids.pan = await variant(ids.sinPrecio, "PAN-1")

  // Precios en USD por método (Filipina más barata en efectivo).
  await owner(
    `insert into public.product_prices (product_id, payment_method_id, amount_usd) values
       ($1, $4, 25), ($1, $5, 20), ($1, $6, 22), ($1, $7, 25),
       ($2, $4, 10), ($2, $5, 10),
       ($3, $4, 15), ($3, $5, 15)`,
    [ids.filipina, ids.gorro, ids.delantal, ids.pagoMovil, ids.cashUsd, ids.usdt, ids.eur]
  )

  await owner(
    `insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values
       ($1, 'initial_count', 1000, 8), ($2, 'initial_count', 1, 5)`,
    [ids.fil, ids.del]
  )
  ids.customer = (
    await owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Ana', '+584141234567') returning id")
  ).rows[0].id
})

describe("create_sale: stock y precios", () => {
  it("vende de inventario, descuenta stock y cobra en el libro", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 2 }], { payments: [{ method: "cashUsd", amount: 40 }] })
    expect(await stock("fil")).toBe(998)
    expect(await summary(sale)).toMatchObject({ total_usd: "40.00", payment_status: "paid" })
    expect(await balance("cash")).toBe(40)
  })

  it("permite ventas sin cliente y con cliente", async () => {
    await expect(sell(staff, [{ variant: "fil", quantity: 1 }])).resolves.toBeTruthy()
    await expect(sell(staff, [{ variant: "fil", quantity: 1 }], { customer: ids.customer })).resolves.toBeTruthy()
  })

  it("rechaza toda la venta si una línea de inventario no tiene stock", async () => {
    const before = await stock("fil")
    await expect(
      sell(staff, [
        { variant: "fil", quantity: 1 },
        { variant: "del", quantity: 5 },
      ])
    ).rejects.toThrow(/Stock insuficiente/)
    expect(await stock("fil")).toBe(before)
  })

  it("las líneas por encargo no validan stock y quedan en to_produce", async () => {
    const sale = await sell(staff, [{ variant: "gor", quantity: 3, source: "made_to_order" }])
    const status = await owner<{ status: string }>(
      `select c.status from public.sale_item_current_status c
       join public.sale_items i on i.id = c.sale_item_id where i.sale_id = $1`,
      [sale]
    )
    expect(status.rows[0].status).toBe("to_produce")
  })

  it("un producto 'both' puede venderse por encargo aunque no haya stock", async () => {
    await expect(sell(staff, [{ variant: "del", quantity: 4, source: "made_to_order" }])).resolves.toBeTruthy()
    expect(await stock("del")).toBe(1)
  })

  it("respeta el tipo de despacho del producto", async () => {
    await expect(sell(staff, [{ variant: "gor", quantity: 1, source: "stock" }])).rejects.toThrow(/solo por encargo/)
    await expect(sell(staff, [{ variant: "fil", quantity: 1, source: "made_to_order" }])).rejects.toThrow(
      /solo de inventario/
    )
  })

  it("usa el precio del método elegido y bloquea si no hay precio", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }], { priceMethod: "pagoMovil" })
    expect((await summary(sale)).total_usd).toBe("25.00")
    await expect(sell(staff, [{ variant: "pan", quantity: 1 }])).rejects.toThrow(/no tiene precio/)
  })
})

describe("pagos: conversión, abonos y pagos mixtos", () => {
  it("un pago en Bs se convierte con la tasa BCV dólar", async () => {
    // 25 USD × 40 = 1.000 Bs.
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }], {
      priceMethod: "pagoMovil",
      payments: [{ method: "pagoMovil", amount: 1000 }],
    })
    const s = await summary(sale)
    expect(s.payment_status).toBe("paid")
    // Valor real: 1.000 Bs ÷ Binance 50 = 20 USDT.
    expect(Number(s.collected_usdt)).toBe(20)
  })

  it("un método con tasa BCV euro convierte con esa tasa", async () => {
    // 25 USD × 44 = 1.100 Bs.
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }], {
      priceMethod: "eur",
      payments: [{ method: "eur", amount: 1100 }],
    })
    expect((await summary(sale)).payment_status).toBe("paid")
  })

  it("una venta mixta (Bs y USD) cuadra el saldo en USD", async () => {
    // Total 25 USD: 10 en efectivo + 15 USD en Bs (15 × 40 = 600 Bs).
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }], {
      priceMethod: "pagoMovil",
      payments: [
        { method: "cashUsd", amount: 10 },
        { method: "pagoMovil", amount: 600 },
      ],
    })
    const s = await summary(sale)
    expect(Number(s.paid_usd)).toBeCloseTo(25, 6)
    expect(Number(s.balance_usd)).toBe(0)
    expect(s.payment_status).toBe("paid")
  })

  it("un abono en Bs pagado días después usa la tasa de ese día", async () => {
    // Venta de 25 USD con abono de 10 USD en efectivo.
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }], {
      priceMethod: "pagoMovil",
      payments: [{ method: "cashUsd", amount: 10 }],
    })
    expect((await summary(sale)).payment_status).toBe("partial")

    // Días después el BCV sube a 60: el saldo de 15 USD son 900 Bs.
    await setRate(60, 66, 70)
    await pay(staff, sale, "pagoMovil", 900)
    const s = await summary(sale)
    expect(Number(s.balance_usd)).toBe(0)
    expect(s.payment_status).toBe("paid")

    const payment = await owner<{ applied_rate: string; usd_amount: string; bcv_usd_rate: string }>(
      "select applied_rate, usd_amount, bcv_usd_rate from public.sale_payments where sale_id = $1 and currency = 'VES'",
      [sale]
    )
    expect(Number(payment.rows[0].applied_rate)).toBe(60)
    expect(Number(payment.rows[0].usd_amount)).toBe(15)
    // La venta conserva la tasa del día en que se hizo.
    const saleRow = await owner<{ bcv_usd_rate: string }>("select bcv_usd_rate from public.sales where id = $1", [sale])
    expect(Number(saleRow.rows[0].bcv_usd_rate)).toBe(40)

    await setRate(40, 44, 50)
  })

  it("no permite pagar más que el saldo", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }], { payments: [{ method: "cashUsd", amount: 15 }] })
    await expect(pay(staff, sale, "cashUsd", 10)).rejects.toThrow(/supera el saldo/)
  })

  it("bloquea cobrar en Bs si la última tasa no es de hoy", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }])
    // Simula que solo hay tasas viejas: una transacción que borra "hoy" no es posible (inmutable),
    // así que se prueba con una base aparte.
    const other = await createTestDb()
    await createUser(other, { id: OWNER, email: "o@t.test", role: "owner" })
    const o = asUser(other, OWNER)
    // Tasa registrada hace días (la auditoría pone created_at = now(); se apaga solo en esta base).
    await other.exec("alter table public.exchange_rates disable trigger exchange_rates_created_audit")
    await other.query(
      `insert into public.exchange_rates (rate_date, bcv_usd, bcv_eur, binance_usdt, created_by, created_at)
       values ('2020-01-01', 1, 1, 1, $1, '2020-01-01T12:00:00Z')`,
      [OWNER]
    )
    await expect(o("select public.require_current_exchange_rate()")).rejects.toThrow(/Falta la tasa BCV de hoy/)
    expect(sale).toBeTruthy()
  })

  it("nadie inserta pagos de venta directo en el libro", async () => {
    await expect(
      owner(
        `insert into public.ledger_entries (account_id, entry_type, category_id, amount)
         values ($1, 'sale_payment', (select id from public.movement_categories where is_system and type = 'sales'), 10)`,
        [ids.cash]
      )
    ).rejects.toThrow(/módulo de ventas/)
  })
})

describe("descuentos y delivery", () => {
  it("aplica descuento con motivo y registra quién lo hizo; suma el delivery", async () => {
    // 2 × 20 = 40, −10% = 36, + 5 delivery = 41.
    const sale = await sell(staff, [{ variant: "fil", quantity: 2 }], {
      deliveryFee: 5,
      discount: { type: "percent", value: 10, reason: "Cliente frecuente" },
    })
    const row = await owner<{ discount_usd: string; total_usd: string; discount_by: string }>(
      "select discount_usd, total_usd, discount_by from public.sales where id = $1",
      [sale]
    )
    expect(row.rows[0]).toMatchObject({ discount_usd: "4.00", total_usd: "41.00", discount_by: STAFF })
  })

  it("exige motivo", async () => {
    await expect(
      sell(staff, [{ variant: "fil", quantity: 1 }], { discount: { type: "amount", value: 1 } })
    ).rejects.toThrow(/motivo del descuento/)
  })

  it("staff no puede superar el máximo configurado; owner y admin sí", async () => {
    await expect(
      sell(staff, [{ variant: "fil", quantity: 1 }], { discount: { type: "percent", value: 15, reason: "x" } })
    ).rejects.toThrow(/descuento máximo sin owner o admin es 10%/)
    await expect(
      sell(admin, [{ variant: "fil", quantity: 1 }], { discount: { type: "percent", value: 15, reason: "x" } })
    ).resolves.toBeTruthy()
  })

  it("el máximo lo cambia owner o admin, no staff", async () => {
    await admin("update public.sales_settings set staff_max_discount_percent = 20")
    await expect(
      sell(staff, [{ variant: "fil", quantity: 1 }], { discount: { type: "percent", value: 15, reason: "x" } })
    ).resolves.toBeTruthy()
    const updated = await staff("update public.sales_settings set staff_max_discount_percent = 50 returning *")
    expect(updated.rows).toHaveLength(0)
    await admin("update public.sales_settings set staff_max_discount_percent = 10")
  })
})

describe("inmutabilidad y permisos", () => {
  it("ventas, líneas y pagos no se editan ni se borran", async () => {
    const sale = await sell(owner, [{ variant: "fil", quantity: 1 }], { payments: [{ method: "cashUsd", amount: 20 }] })
    await expect(db.query("update public.sales set notes = 'x' where id = $1", [sale])).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.sale_items where sale_id = $1", [sale])).rejects.toThrow(/no se editan/)
    await expect(db.query("delete from public.sale_payments where sale_id = $1", [sale])).rejects.toThrow(/no se editan/)
  })

  it("nadie inserta ventas directo: solo con create_sale", async () => {
    await expect(
      owner(
        `insert into public.sales (channel, price_method_id, delivery_method, subtotal_usd, total_usd,
           bcv_usd_rate, bcv_eur_rate, binance_rate, usd_usdt_rate)
         values ('in_person', $1, 'pickup', 1, 1, 1, 1, 1, 1)`,
        [ids.cashUsd]
      )
    ).rejects.toThrow(/permission denied/)
  })

  it("staff ve las ventas pero no los totales", async () => {
    const sales = await staff("select * from public.sales")
    expect(sales.rows.length).toBeGreaterThan(0)
    const totals = await staff("select * from public.sales_daily_totals")
    expect(totals.rows).toHaveLength(0)
    const ownerTotals = await owner("select * from public.sales_daily_totals")
    expect(ownerTotals.rows.length).toBeGreaterThan(0)
  })

  it("los pagos de venta no se revierten sueltos", async () => {
    const sale = await sell(owner, [{ variant: "fil", quantity: 1 }], { payments: [{ method: "cashUsd", amount: 20 }] })
    const entry = await owner<{ ledger_entry_id: string }>("select ledger_entry_id from public.sale_payments where sale_id = $1", [
      sale,
    ])
    await expect(
      owner("insert into public.ledger_entries (reverses_entry_id, description) values ($1, 'error')", [
        entry.rows[0].ledger_entry_id,
      ])
    ).rejects.toThrow(/anulando la venta/)
  })
})

describe("anulación", () => {
  it("staff no puede anular", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }])
    await expect(staff("select public.void_sale($1, 'error')", [sale])).rejects.toThrow(/Solo owner y admin/)
  })

  it("revierte exactamente el stock y el dinero de la venta", async () => {
    const stockBefore = await stock("fil")
    const cashBefore = await balance("cash")
    const bankBefore = await balance("bank")

    const sale = await sell(staff, [{ variant: "fil", quantity: 2 }], {
      priceMethod: "pagoMovil",
      payments: [
        { method: "cashUsd", amount: 30 },
        { method: "pagoMovil", amount: 800 },
      ],
    })
    expect(await stock("fil")).toBe(stockBefore - 2)

    await admin("select public.void_sale($1, 'Cliente devolvió todo')", [sale])

    expect(await stock("fil")).toBe(stockBefore)
    expect(await balance("cash")).toBe(cashBefore)
    expect(await balance("bank")).toBe(bankBefore)
    expect((await summary(sale)).payment_status).toBe("voided")
  })

  it("una venta anulada no recibe pagos ni se anula dos veces", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }])
    await owner("select public.void_sale($1, 'Error')", [sale])
    await expect(pay(staff, sale, "cashUsd", 5)).rejects.toThrow(/anulada/)
    await expect(owner("select public.void_sale($1, 'Otra vez')", [sale])).rejects.toThrow(/ya está anulada/)
  })

  it("exige motivo", async () => {
    const sale = await sell(staff, [{ variant: "fil", quantity: 1 }])
    await expect(owner("select public.void_sale($1, '  ')", [sale])).rejects.toThrow(/motivo/)
  })
})

describe("estados de línea", () => {
  it("se elige cualquier estado posterior; volver atrás es de owner o admin, con motivo", async () => {
    const sale = await sell(staff, [{ variant: "gor", quantity: 1, source: "made_to_order" }])
    const item = (
      await owner<{ id: string }>("select id from public.sale_items where sale_id = $1", [sale])
    ).rows[0].id

    await staff("select public.set_sale_item_status($1, 'ready')", [item])
    await expect(staff("select public.set_sale_item_status($1, 'sewing', 'error')", [item])).rejects.toThrow(/Solo owner o admin/)
    await expect(owner("select public.set_sale_item_status($1, 'sewing')", [item])).rejects.toThrow(/motivo/)
    await owner("select public.set_sale_item_status($1, 'sewing', 'no estaba lista')", [item])
    await staff("select public.set_sale_item_status($1, 'delivered')", [item])

    const events = await owner<{ status: string; created_by: string }>(
      "select status, created_by from public.sale_item_status_events where sale_item_id = $1 order by created_at",
      [item]
    )
    expect(events.rows.map((e) => e.status)).toEqual(["to_produce", "ready", "sewing", "delivered"])
    expect(events.rows[1].created_by).toBe(STAFF)
    expect(events.rows[2].created_by).toBe(OWNER)
  })
})

describe("métodos de pago: tasa", () => {
  it("un método en Bs necesita tasa BCV y uno en USD no lleva", async () => {
    await expect(
      owner("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('X', $1, 'USD', 'none')", [
        ids.bank,
      ])
    ).rejects.toThrow(/necesita una tasa BCV/)
    await expect(
      owner(
        "insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Y', $1, 'USD', 'bcv_usd')",
        [ids.cash]
      )
    ).rejects.toThrow(/Solo los métodos que cobran en Bs/)
  })
})
