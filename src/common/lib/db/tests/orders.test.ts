import { beforeAll, describe, expect, it } from "vitest"

import { asUser, createTestDb, createUser, TEST_USERS, type TestDb } from "@/common/lib/db/tests/db-test.util"

const { OWNER, STAFF } = TEST_USERS

let db: TestDb
let owner: ReturnType<typeof asUser>
let staff: ReturnType<typeof asUser>
const ids: Record<string, string> = {}

const one = async <T>(promise: Promise<{ rows: T[] }>) => (await promise).rows[0]

type Custom = { type: string; quantity?: number; text?: string; logo?: string; size?: number; names?: string[] }
type Item = { variant: string; quantity: number; customizations?: Custom[] }

const order = (
  as: ReturnType<typeof asUser>,
  items: Item[],
  options: { mode?: "reserve_and_produce" | "produce_all"; customer?: string; payments?: { method: string; amount: number }[] } = {}
) =>
  as<{ id: string }>(
    `select public.create_order(
       p_customer_id => $1, p_price_method_id => $2, p_channel => 'whatsapp', p_delivery_method => 'pickup',
       p_items => $3::jsonb, p_stock_mode => $4::public.order_stock_mode, p_payments => $5::jsonb
     ) as id`,
    [
      ids[options.customer ?? "customer"],
      ids.cash,
      JSON.stringify(
        items.map((i) => ({
          variant_id: ids[i.variant],
          quantity: i.quantity,
          customizations: (i.customizations ?? []).map((c) => ({
            type_id: ids[c.type],
            quantity: c.quantity,
            text: c.text,
            logo_path: c.logo,
            size_cm: c.size,
            names: c.names,
          })),
        }))
      ),
      options.mode ?? "reserve_and_produce",
      JSON.stringify((options.payments ?? []).map((p) => ({ payment_method_id: ids[p.method], amount: p.amount }))),
    ]
  ).then((r) => r.rows[0].id)

const lines = (sale: string) =>
  owner<{ id: string; quantity: string; reserved_quantity: string; source: string; status: string }>(
    `select i.id, i.quantity, i.reserved_quantity, i.source, cs.status
     from public.sale_items i join public.sale_item_current_status cs on cs.sale_item_id = i.id
     where i.sale_id = $1 order by i.created_at, i.id`,
    [sale]
  ).then((r) => r.rows)

const overview = (sale: string) =>
  one(
    owner<{ status: string; deposit_required_usd: string; total_usd: string; can_start: boolean; is_late: boolean }>(
      "select * from public.orders_overview where sale_id = $1",
      [sale]
    )
  )

const advance = (as: ReturnType<typeof asUser>, item: string) =>
  as<{ next: string }>("select public.next_line_stage($1) as next", [item]).then(async (r) => {
    await as("select public.set_sale_item_status($1, $2::public.sale_item_status)", [item, r.rows[0].next])
    return r.rows[0].next
  })

const advanceTo = async (item: string, stage: string) => {
  for (let i = 0; i < 10; i++) {
    const next = await advance(owner, item)
    if (next === stage) return
  }
  throw new Error(`no llegó a ${stage}`)
}

const stock = (variant: string) =>
  one(owner<{ quantity: string }>("select quantity from public.stock_balances where variant_id = $1", [ids[variant]])).then((r) =>
    Number(r?.quantity ?? 0)
  )

const balance = (account: string) =>
  one(owner<{ balance: string }>("select balance from public.account_balances where account_id = $1", [ids[account]])).then((r) =>
    Number(r.balance)
  )

beforeAll(async () => {
  db = await createTestDb()
  await createUser(db, { id: OWNER, email: "owner@t.test", role: "owner" })
  await createUser(db, { id: STAFF, email: "staff@t.test", role: "staff" })
  owner = asUser(db, OWNER)
  staff = asUser(db, STAFF, { aal: "aal1" })

  await owner("insert into public.exchange_rates (bcv_usd, bcv_eur, binance_usdt) values (40, 44, 50)")
  ids.cashAccount = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Caja', 'USD', 'cash') returning id"))).id
  ids.bankAccount = (await one(owner<{ id: string }>("insert into public.accounts (name, currency, kind) values ('Banco', 'VES', 'bank') returning id"))).id
  ids.cash = (
    await one(
      owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Efectivo', $1, 'USD', 'none') returning id", [
        ids.cashAccount,
      ])
    )
  ).id
  ids.mobile = (
    await one(
      owner<{ id: string }>("insert into public.payment_methods (name, account_id, price_currency, rate_kind) values ('Pago móvil', $1, 'USD', 'bcv_usd') returning id", [
        ids.bankAccount,
      ])
    )
  ).id
  await owner("insert into public.movement_categories (name, type) values ('Sueldos', 'salary')")

  const category = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Filipinas', 'FIL') returning id"))
  ids.category = category.id
  const ins = await one(owner<{ id: string }>("insert into public.product_categories (name, code) values ('Insumos', 'INS') returning id"))
  const color = await one(owner<{ id: string }>("insert into public.colors (name, code) values ('Negro', 'NEG') returning id"))

  // Tela negra (materia prima) y filipina negra con receta de 2 m.
  const fabric = await one(
    owner<{ id: string }>("insert into public.products (category_id, name, kind, unit) values ($1, 'Tela', 'raw_material', 'meter') returning id", [ins.id])
  )
  ids.fabric = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku, color_id) values ($1, 'INS-TEL-NEG', $2) returning id", [fabric.id, color.id]))).id
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 100, 5)", [ids.fabric])

  const filipina = await one(
    owner<{ id: string }>("insert into public.products (category_id, name, fulfillment_type) values ($1, 'Filipina', 'both') returning id", [category.id])
  )
  ids.filipinaProduct = filipina.id
  ids.fil = (await one(owner<{ id: string }>("insert into public.product_variants (product_id, sku, color_id) values ($1, 'FIL-NEG', $2) returning id", [filipina.id, color.id]))).id
  await owner("insert into public.product_recipe_lines (product_id, raw_product_id, quantity) values ($1, $2, 2)", [filipina.id, fabric.id])
  await owner("insert into public.stock_movements (variant_id, movement_type, quantity, unit_cost_usdt) values ($1, 'initial_count', 3, 12)", [ids.fil])
  await owner("insert into public.product_prices (product_id, payment_method_id, amount_usd) values ($1, $2, 25), ($1, $3, 28)", [filipina.id, ids.cash, ids.mobile])

  ids.customer = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Restaurante', '+584141111111') returning id"))).id
  ids.customer2 = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Ana', '+584142222222') returning id"))).id
  ids.customer3 = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Luis', '+584143333333') returning id"))).id

  for (const code of ["embroidered_name", "pocket_logo", "chest_logo"]) {
    ids[code] = (await one(owner<{ id: string }>("select id from public.customization_types where code = $1", [code]))).id
  }
  await owner("update public.customization_types set unit_price_usd = 6 where code in ('pocket_logo', 'chest_logo')")

  ids.maria = (await one(owner<{ id: string }>("insert into public.team_members (full_name, pay_basis) values ('María', 'piecework') returning id"))).id
  ids.workshop = (await one(owner<{ id: string }>("insert into public.suppliers (name, kind) values ('Bordados Express', 'workshop') returning id"))).id
  ids.goods = (await one(owner<{ id: string }>("insert into public.suppliers (name) values ('Textiles') returning id"))).id
})

describe("crear pedidos", () => {
  it("necesita cliente y fecha prometida por defecto a 5 días", async () => {
    await expect(owner("select public.create_order(null, $1, 'whatsapp', 'pickup', '[]'::jsonb, 'produce_all')", [ids.cash])).rejects.toThrow(/necesita cliente/)
    const id = await order(staff, [{ variant: "fil", quantity: 1 }], { mode: "produce_all" })
    const row = await one(owner<{ days: number }>("select promised_date - public.caracas_today() as days from public.orders where sale_id = $1", [id]))
    expect(row.days).toBe(5)
  })

  it("reservar y producir lo que falta aparta el stock y produce el resto", async () => {
    const before = await stock("fil")
    const id = await order(owner, [{ variant: "fil", quantity: 5 }])
    const [line] = await lines(id)
    expect(line).toMatchObject({ quantity: "5.000", reserved_quantity: "3.000", source: "made_to_order", status: "to_produce" })
    expect(await stock("fil")).toBe(before - 3)
    ids.mixedOrder = id
  })

  it("producir todo desde cero no toca el stock", async () => {
    const before = await stock("fil")
    const id = await order(owner, [{ variant: "fil", quantity: 2 }], { mode: "produce_all" })
    const [line] = await lines(id)
    expect(Number(line.reserved_quantity)).toBe(0)
    expect(await stock("fil")).toBe(before)
  })
})

describe("abono", () => {
  it("bajo el umbral se paga completo; desde el umbral, 60%", async () => {
    const small = await order(owner, [{ variant: "fil", quantity: 2 }], { mode: "produce_all" })
    expect(Number((await overview(small)).deposit_required_usd)).toBe(50)

    const big = await order(owner, [{ variant: "fil", quantity: 20 }], { mode: "produce_all" })
    const o = await overview(big)
    expect(Number(o.total_usd)).toBe(500)
    expect(Number(o.deposit_required_usd)).toBe(300)
    expect(o.can_start).toBe(false)
    ids.bigOrder = big
  })

  it("sin el abono no se empieza a producir; con abono o excepción sí", async () => {
    const [line] = await lines(ids.bigOrder)
    await expect(advance(staff, line.id)).rejects.toThrow(/Falta el abono para empezar: se requieren 300/)
    await owner("select public.add_sale_payment($1, $2, 300)", [ids.bigOrder, ids.cash])
    expect(await advance(staff, line.id)).toBe("cutting")
  })

  it("owner o admin autorizan producir sin abono, con motivo", async () => {
    const id = await order(owner, [{ variant: "fil", quantity: 1 }], { mode: "produce_all" })
    const [line] = await lines(id)
    await expect(staff("select public.allow_order_without_deposit($1, 'cliente fijo')", [id])).rejects.toThrow(/Solo owner y admin/)
    await owner("select public.allow_order_without_deposit($1, 'cliente fijo')", [id])
    expect(await advance(staff, line.id)).toBe("cutting")
  })
})

describe("etapas", () => {
  it("salta las que no aplican y consume la tela al terminar el corte", async () => {
    // Línea 100% del stock (sin corte ni confección, sin personalización).
    const fromStock = await order(owner, [{ variant: "fil", quantity: 1 }], { mode: "produce_all" })
    await owner("select public.allow_order_without_deposit($1, 'prueba')", [fromStock])
    const [line] = await lines(fromStock)
    expect(await advance(owner, line.id)).toBe("cutting")
    const fabricBefore = await stock("fabric")
    expect(await advance(owner, line.id)).toBe("sewing")
    expect(await stock("fabric")).toBe(fabricBefore - 2)
    expect(await advance(owner, line.id)).toBe("quality_check")
    expect(await advance(owner, line.id)).toBe("packing")
    expect(await advance(owner, line.id)).toBe("ready")
  })

  it("las líneas totalmente apartadas no pasan por corte ni confección", async () => {
    await owner("insert into public.stock_movements (variant_id, movement_type, quantity, note) values ($1, 'adjustment', 5, 'Conteo')", [ids.fil])
    const id = await order(owner, [{ variant: "fil", quantity: 2 }], {
      payments: [{ method: "cash", amount: 50 }],
    })
    const [line] = await lines(id)
    expect(Number(line.reserved_quantity)).toBe(2)
    expect(await advance(owner, line.id)).toBe("quality_check")
  })

  it("no se puede saltar a otra etapa ni entregar una línea suelta", async () => {
    const [line] = await lines(ids.bigOrder)
    await expect(owner("select public.set_sale_item_status($1, 'packing')", [line.id])).rejects.toThrow(/siguiente etapa/)
    await expect(owner("select public.set_sale_item_status($1, 'delivered')", [line.id])).rejects.toThrow(/pedido completo/)
  })
})

describe("personalización", () => {
  it("valida precio, medida, logo, nombres y mínimos", async () => {
    await expect(order(owner, [{ variant: "fil", quantity: 6, customizations: [{ type: "pocket_logo", logo: "logos/a.png", size: 10 }] }])).rejects.toThrow(
      /hasta 8 cm/
    )
    await expect(order(owner, [{ variant: "fil", quantity: 6, customizations: [{ type: "pocket_logo", size: 7 }] }])).rejects.toThrow(/archivo del logo/)
    await expect(order(owner, [{ variant: "fil", quantity: 3, customizations: [{ type: "chest_logo", logo: "logos/a.png" }] }])).rejects.toThrow(
      /desde 6 piezas/
    )
    await expect(order(owner, [{ variant: "fil", quantity: 2, customizations: [{ type: "embroidered_name", names: ["Ana"] }] }])).rejects.toThrow(
      /van 1 nombres para 2 piezas/
    )
    await owner("update public.customization_types set unit_price_usd = null where code = 'chest_logo'")
    await expect(order(owner, [{ variant: "fil", quantity: 6, customizations: [{ type: "chest_logo", logo: "logos/a.png" }] }])).rejects.toThrow(
      /todavía no tiene precio/
    )
    await owner("update public.customization_types set unit_price_usd = 6 where code = 'chest_logo'")
  })

  it("suma al total con su descuento al mayor por tipo y guarda los nombres", async () => {
    await owner("insert into public.volume_discount_tiers (scope, min_quantity, percent) values ('customization', 3, 10)")
    const id = await order(owner, [{ variant: "fil", quantity: 3, customizations: [{ type: "embroidered_name", names: ["Ana", "Luis", "Rosa"] }] }], {
      mode: "produce_all",
    })
    // 3 × 25 = 75 + nombres 3 × 4 × 0,9 = 10,80.
    const sale = await one(owner<{ subtotal_usd: string; total_usd: string }>("select subtotal_usd, total_usd from public.sales where id = $1", [id]))
    expect(Number(sale.subtotal_usd)).toBe(85.8)
    const names = await owner<{ name: string }>(
      `select n.name from public.sale_item_customization_names n
       join public.sale_item_customizations c on c.id = n.customization_id
       join public.sale_items i on i.id = c.sale_item_id where i.sale_id = $1 order by n.ordinal`,
      [id]
    )
    expect(names.rows.map((r) => r.name)).toEqual(["Ana", "Luis", "Rosa"])

    // La línea personalizada pasa por la etapa de personalización.
    await owner("select public.allow_order_without_deposit($1, 'prueba')", [id])
    const [line] = await lines(id)
    await advanceTo(line.id, "sewing")
    expect(await advance(owner, line.id)).toBe("customization")
  })
})

describe("asignaciones, talleres y destajo", () => {
  it("asigna etapas a personas o talleres (solo talleres de tipo taller)", async () => {
    const [line] = await lines(ids.bigOrder)
    await expect(owner("select public.assign_stage($1, 'sewing', null, $2)", [line.id, ids.goods])).rejects.toThrow(/no es un taller/)
    await owner("select public.assign_stage($1, 'cutting', $2)", [line.id, ids.maria])
    await owner("select public.assign_stage($1, 'sewing', null, $2, public.caracas_today() - 1)", [line.id, ids.workshop])
    const queue = await one(owner<{ team_member_id: string }>("select * from public.production_queue where sale_item_id = $1", [line.id]))
    expect(queue.team_member_id).toBe(ids.maria)
  })

  it("al completar la etapa cuenta las piezas a destajo con la tarifa de la categoría", async () => {
    await owner("insert into public.piece_rates (product_category_id, stage, rate_usd) values ($1, 'cutting', 0.5)", [ids.category])
    const [line] = await lines(ids.bigOrder)
    await advance(owner, line.id) // corte → confección
    const entry = await one(owner<{ pieces: string; amount_usd: string }>("select pieces, amount_usd from public.pending_piecework where team_member_id = $1", [ids.maria]))
    expect(entry).toMatchObject({ pieces: "20.000", amount_usd: "10.00" })
    // El taller de confección quedó atrasado.
    const late = await one(owner<{ workshop_late: boolean }>("select workshop_late from public.production_queue where sale_item_id = $1", [line.id]))
    expect(late.workshop_late).toBe(true)
    // Staff no ve el destajo.
    expect((await staff("select * from public.piecework_entries")).rows).toHaveLength(0)
  })

  it("se paga como sueldo y las piezas quedan liquidadas", async () => {
    const pending = await owner<{ id: string }>("select id from public.pending_piecework where team_member_id = $1", [ids.maria])
    await owner("select public.register_piecework_payment($1, $2, 10, $3::uuid[])", [ids.maria, ids.cashAccount, pending.rows.map((r) => r.id)])
    expect((await owner("select * from public.pending_piecework where team_member_id = $1", [ids.maria])).rows).toHaveLength(0)
    await expect(
      owner("select public.register_piecework_payment($1, $2, 10, $3::uuid[])", [ids.maria, ids.cashAccount, pending.rows.map((r) => r.id)])
    ).rejects.toThrow(/ya se pagó/)
  })
})

describe("entrega", () => {
  it("solo con todo listo; con saldo pide el pago o una excepción de owner o admin", async () => {
    const id = await order(owner, [{ variant: "fil", quantity: 2 }], { mode: "produce_all", payments: [{ method: "cash", amount: 50 }] })
    const [line] = await lines(id)
    await expect(owner("select public.deliver_order($1)", [id])).rejects.toThrow(/no están listas/)
    await advanceTo(line.id, "ready")
    await owner("select public.deliver_order($1)", [id])
    expect((await overview(id)).status).toBe("delivered")

    // Pedido pagado al 60%: entrega con saldo.
    const big = await order(owner, [{ variant: "fil", quantity: 20 }], { mode: "produce_all", payments: [{ method: "cash", amount: 300 }] })
    const [bigLine] = await lines(big)
    await advanceTo(bigLine.id, "ready")
    await expect(owner("select public.deliver_order($1)", [big])).rejects.toThrow(/saldo de 200 USD/)
    await expect(staff("select public.deliver_order($1, 'paga mañana')", [big])).rejects.toThrow(/solo owner o admin/)
    await owner("select public.deliver_order($1, 'paga mañana')", [big])
    expect((await overview(big)).status).toBe("delivered")
  })
})

describe("cancelación y bloqueo", () => {
  it("antes del corte: cualquiera cancela, devuelve cada pago en su moneda y bloquea al cliente", async () => {
    const id = await order(staff, [{ variant: "fil", quantity: 4 }], {
      customer: "customer2",
      mode: "produce_all",
      payments: [
        { method: "cash", amount: 50 },
        { method: "mobile", amount: 2000 }, // 50 USD a BCV 40
      ],
    })
    const cashBefore = await balance("cashAccount")
    const bankBefore = await balance("bankAccount")
    await staff("select public.cancel_order($1, 'Ya no lo necesita')", [id])
    expect(await balance("cashAccount")).toBe(cashBefore - 50)
    expect(await balance("bankAccount")).toBe(bankBefore - 2000)
    expect((await overview(id)).status).toBe("cancelled")

    const customer = await one(owner<{ blocked_at: string | null }>("select blocked_at from public.customers where id = $1", [ids.customer2]))
    expect(customer.blocked_at).not.toBeNull()
    await expect(order(owner, [{ variant: "fil", quantity: 1 }], { customer: "customer2" })).rejects.toThrow(/Cliente bloqueado/)
    await expect(
      owner(
        `select public.create_sale(p_channel => 'in_person', p_price_method_id => $1, p_delivery_method => 'pickup',
           p_items => $2::jsonb, p_customer_id => $3)`,
        [ids.cash, JSON.stringify([{ variant_id: ids.fil, quantity: 1, source: "stock" }]), ids.customer2]
      )
    ).rejects.toThrow(/Cliente bloqueado/)
  })

  it("después del corte: solo owner o admin, con el descuento de materiales", async () => {
    const id = await order(owner, [{ variant: "fil", quantity: 2 }], { customer: "customer3", mode: "produce_all", payments: [{ method: "cash", amount: 50 }] })
    const [line] = await lines(id)
    await advanceTo(line.id, "sewing") // consumió 4 m de tela a 5 USDT
    const quote = await one(owner<{ materials_usdt: string; suggested_deduction_usdt: string; production_started: boolean }>("select * from public.order_cancellation_quote($1)", [id]))
    expect(quote).toMatchObject({ production_started: true })
    expect(Number(quote.materials_usdt)).toBe(20)

    await expect(staff("select public.cancel_order($1, 'Cambió de idea')", [id])).rejects.toThrow(/solo owner o admin/)
    await expect(owner("select public.cancel_order($1, 'Cambió de idea')", [id])).rejects.toThrow(/cuánto no se devuelve/)
    const before = await balance("cashAccount")
    await owner("select public.cancel_order($1, 'Cambió de idea', 20)", [id])
    expect(await balance("cashAccount")).toBe(before - 30)
    const row = await one(owner<{ deduction_usdt: string; refunded_usdt: string }>("select * from public.order_cancellations where sale_id = $1", [id]))
    expect(Number(row.deduction_usdt)).toBe(20)
    expect(Number(row.refunded_usdt)).toBe(30)
  })

  it("misma cédula que un bloqueado: el nuevo cliente también queda bloqueado", async () => {
    await owner("select public.set_customer_id_document($1, 'V12345678')", [ids.customer2])
    const fresh = (await one(owner<{ id: string }>("insert into public.customers (first_name, phone) values ('Otra', '+584149999999') returning id"))).id
    await owner("select public.set_customer_id_document($1, 'V12345678')", [fresh])
    const row = await one(owner<{ blocked_at: string | null }>("select blocked_at from public.customers where id = $1", [fresh]))
    expect(row.blocked_at).not.toBeNull()
    const match = await one(staff<{ customer_name: string }>("select * from public.blocked_customer_match(p_phone => '+584142222222')"))
    expect(match.customer_name).toBe("Ana")
  })

  it("solo owner o admin desbloquean, con motivo, y queda registrado", async () => {
    await expect(staff("select public.unblock_customer($1, 'pagó')", [ids.customer2])).rejects.toThrow(/Solo owner y admin/)
    await expect(owner("update public.customers set blocked_at = null where id = $1", [ids.customer2])).rejects.toThrow()
    await owner("select public.unblock_customer($1, 'Acordamos pago por adelantado')", [ids.customer2])
    const events = await owner<{ action: string }>("select action from public.customer_block_events where customer_id = $1 order by created_at", [ids.customer2])
    expect(events.rows.map((e) => e.action)).toEqual(["block", "unblock"])
  })
})

describe("material y reglas", () => {
  it("material necesario para lo que falta cortar", async () => {
    const rows = await owner<{ sku: string; required: string }>("select sku, required from public.material_requirements()")
    const fabric = rows.rows.find((r) => r.sku === "INS-TEL-NEG")
    expect(Number(fabric?.required)).toBeGreaterThan(0)
  })

  it("todos leen las reglas; solo owner y admin las editan, con historial", async () => {
    const rules = await staff<{ title: string; enforced_by_system: boolean }>("select title, enforced_by_system from public.business_rules")
    expect(rules.rows[0].enforced_by_system).toBe(true)
    await expect(staff("insert into public.business_rules (title, body) values ('Otra', 'Texto de prueba')")).rejects.toThrow()
    const rule = await one(owner<{ id: string }>("insert into public.business_rules (title, body) values ('Delivery', 'Solo en Caracas') returning id"))
    await owner("update public.business_rules set body = 'Solo en Caracas y Miranda' where id = $1", [rule.id])
    const revisions = await owner("select * from public.business_rule_revisions where rule_id = $1", [rule.id])
    expect(revisions.rows).toHaveLength(2)
  })
})
