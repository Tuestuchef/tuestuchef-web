import "server-only"

import { ensureRatesForDate } from "@/modules/treasury/lib/services/rate-history.service"

import type { Currency } from "@/common/lib/constants/currency.constants"
import { fetchAll } from "@/common/lib/db/fetch-all.util"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { caracasMonthRange, caracasNoonIso, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

import type { PaymentStatus, SaleItemStatus } from "../constants/sales.constants"
import type { AddPaymentInput, CorrectPaymentInput, CreateSaleInput, EditSaleInput } from "../schemas/sales.schema"
import { round } from "../utils/sale-math.util"
import type {
  ReceivableGroup,
  SaleDetail,
  SaleEditChange,
  SaleFormData,
  SaleListItem,
  SalesFilters,
  SellableVariant,
  SalesTotals,
} from "../types/sales.types"
import { variantLabel } from "@/modules/products/lib/utils/variant-label.util"

// Cada combo seguido de sus componentes (en el orden en que se registraron).
const withComponentsAfterCombo = <T extends { id: string; parent_item_id: string | null }>(items: T[]): T[] =>
  items
    .filter((item) => !item.parent_item_id)
    .flatMap((item) => [item, ...items.filter((child) => child.parent_item_id === item.id)])

// Fecha del formulario → instante de la venta o pago (vacío u hoy = ahora).
const occurredAt = (date?: string) => (date && date !== toCaracasDate() ? caracasNoonIso(date) : undefined)

const fullName = (c: { first_name: string; last_name: string | null } | null) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null

// Todo lo que necesita la pantalla de venta, en una sola carga.
export async function getSaleFormData(): Promise<SaleFormData> {
  const supabase = await createSupabaseServerClient()
  const [variantsResult, balancesResult, pricesResult, methodsResult, settingsResult, rateStatus, componentsResult, tiersResult, surchargesResult, colorSurchargesResult] = await Promise.all([
    fetchAll((from, to) =>
    supabase
      .from("product_variants")
      .select(
        "id, sku, product_id, size_id, color_id, gender, color:colors(name, sort_order), size:sizes(name, sort_order), product:products!inner(name, kind, is_active, fulfillment_type)"
      )
      .eq("is_active", true)
      .eq("product.is_active", true)
      .neq("product.kind", "raw_material")
      .order("sku")
      .range(from, to)
    ),
    fetchAll((from, to) => supabase.from("stock_balances").select("variant_id, quantity").order("variant_id").range(from, to)),
    supabase.from("product_prices").select("product_id, payment_method_id, amount_usd"),
    supabase
      .from("payment_methods")
      .select("id, name, rate_kind, account:accounts(currency)")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("sales_settings").select("staff_max_discount_percent, staff_max_backdate_days").maybeSingle(),
    getRateStatus(),
    supabase
      .from("combo_components")
      .select(
        "id, combo_product_id, label, quantity, options:combo_component_options(sort_order, product_id, product:products!combo_component_options_product_id_fkey(name))"
      )
      .order("sort_order"),
    supabase.from("volume_discount_tiers").select("min_quantity, percent").eq("scope", "products").order("min_quantity"),
    supabase.from("size_surcharges").select("product_id, size_id, gender, amount_usd"),
    supabase.from("color_surcharges").select("product_id, color_id, amount_usd"),
  ])
  if (variantsResult.error) throw variantsResult.error
  if (methodsResult.error) throw methodsResult.error

  const stock = new Map((balancesResult.data ?? []).map((b) => [b.variant_id, Number(b.quantity ?? 0)]))
  const prices = new Map<string, Record<string, number>>()
  for (const price of pricesResult.data ?? []) {
    const byMethod = prices.get(price.product_id) ?? {}
    byMethod[price.payment_method_id] = Number(price.amount_usd)
    prices.set(price.product_id, byMethod)
  }

  // Recargo por talla y por color (solo productos terminados): se suman al precio de cada método,
  // igual que variant_price_usd en la base.
  // El de la talla: el de su género o, si no hay, el de todos los géneros.
  const sizeExtra = new Map((surchargesResult.data ?? []).map((r) => [`${r.product_id}|${r.size_id}|${r.gender ?? ""}`, Number(r.amount_usd)]))
  const colorExtra = new Map((colorSurchargesResult.data ?? []).map((r) => [`${r.product_id}|${r.color_id}`, Number(r.amount_usd)]))
  type PricedVariant = { product_id: string; size_id: string | null; color_id: string | null; gender: string | null; product: { kind: string } }
  const extraFor = (variant: PricedVariant) =>
    variant.product.kind === "finished_good"
      ? (sizeExtra.get(`${variant.product_id}|${variant.size_id}|${variant.gender ?? ""}`) ??
          sizeExtra.get(`${variant.product_id}|${variant.size_id}|`) ??
          0) + (colorExtra.get(`${variant.product_id}|${variant.color_id}`) ?? 0)
      : 0
  const pricesFor = (variant: PricedVariant) => {
    const base = prices.get(variant.product_id) ?? {}
    const extra = extraFor(variant)
    return extra ? Object.fromEntries(Object.entries(base).map(([method, amount]) => [method, round(amount + extra)])) : base
  }

  const components = new Map<string, NonNullable<SellableVariant["components"]>>()
  for (const row of componentsResult.data ?? []) {
    const products = [...row.options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ productId: o.product_id, productName: o.product?.name ?? "—" }))
    const list = components.get(row.combo_product_id) ?? []
    list.push({ id: row.id, name: row.label ?? products.map((p) => p.productName).join(" / "), quantity: row.quantity, products })
    components.set(row.combo_product_id, list)
  }

  const rate = rateStatus.rate
  return {
    variants: variantsResult.data
      // Un combo sin componentes no se puede vender.
      .filter((v) => v.product.kind !== "combo" || components.has(v.product_id))
      .map((v) => ({
        id: v.id,
        productId: v.product_id,
        sku: v.sku,
        productName: v.product.name,
        variantLabel: v.product.kind === "combo" ? "Combo" : variantLabel(v),
        gender: v.gender,
        color: v.color ? { name: v.color.name, sort: v.color.sort_order } : null,
        size: v.size ? { name: v.size.name, sort: v.size.sort_order } : null,
        fulfillmentType: v.product.fulfillment_type,
        stock: stock.get(v.id) ?? 0,
        pricesUsd: pricesFor(v),
        extraUsd: extraFor(v),
        ...(v.product.kind === "combo" && { components: components.get(v.product_id) }),
      })),
    methods: methodsResult.data.map((m) => ({
      id: m.id,
      name: m.name,
      currency: (m.account?.currency ?? "USD") as Currency,
      rateKind: m.rate_kind,
    })),
    rates: rate
      ? {
          bcvUsd: Number(rate.bcv_usd),
          bcvEur: Number(rate.bcv_eur),
          usdUsdt: Number(rate.usd_usdt),
          isCurrent: rateStatus.hasTodayRate,
        }
      : null,
    staffMaxDiscountPercent: Number(settingsResult.data?.staff_max_discount_percent ?? 10),
    staffMaxBackdateDays: Number(settingsResult.data?.staff_max_backdate_days ?? 7),
    volumeTiers: (tiersResult.data ?? []).map((t) => ({ minQuantity: t.min_quantity, percent: Number(t.percent) })),
    today: rateStatus.today,
  }
}

export async function createSale(input: CreateSaleInput) {
  await ensureRatesForDate(input.date)
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("create_sale", {
    p_channel: input.channel,
    p_price_method_id: input.price_method_id,
    p_delivery_method: input.delivery_method,
    p_items: input.items,
    p_payments: input.payments,
    p_customer_id: input.customer_id ?? undefined,
    p_delivery_fee_usd: input.delivery_fee_usd,
    p_discount_type: input.discount_value ? (input.discount_type ?? undefined) : undefined,
    p_discount_value: input.discount_value ?? undefined,
    p_discount_reason: input.discount_reason ?? undefined,
    p_notes: input.notes ?? undefined,
    p_delivered: input.delivered,
    p_occurred_at: occurredAt(input.date),
  })
}

export async function addSalePayment(input: AddPaymentInput) {
  await ensureRatesForDate(input.date)
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("add_sale_payment", {
    p_sale_id: input.sale_id,
    p_payment_method_id: input.payment_method_id,
    p_amount: input.amount,
    p_receipt_path: input.receipt_path,
    p_occurred_at: occurredAt(input.date),
  })
}

export async function editSaleDetails(input: EditSaleInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("edit_sale_details", {
    p_sale_id: input.sale_id,
    p_customer_id: input.customer_id,
    p_channel: input.channel,
    p_delivery_method: input.delivery_method,
    p_notes: input.notes,
    p_reason: input.reason,
  })
}

export async function correctSalePayment(input: CorrectPaymentInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("correct_sale_payment", {
    p_payment_id: input.payment_id,
    p_payment_method_id: input.payment_method_id,
    p_amount: input.amount,
    p_reason: input.reason,
  })
}

export async function voidSale(saleId: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("void_sale", { p_sale_id: saleId, p_reason: reason })
}

export async function setSaleItemStatus(itemId: string, status: SaleItemStatus, note?: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("set_sale_item_status", { p_sale_item_id: itemId, p_status: status, p_note: note })
}

export async function updateSalesSettings(settings: { staffMaxDiscountPercent: number; staffMaxBackdateDays: number }) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("sales_settings")
    .update({
      staff_max_discount_percent: settings.staffMaxDiscountPercent,
      staff_max_backdate_days: settings.staffMaxBackdateDays,
    })
    .eq("id", true)
    .select("id")
}

export async function getSalesSettings(): Promise<{ staffMaxDiscountPercent: number; staffMaxBackdateDays: number }> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("sales_settings")
    .select("staff_max_discount_percent, staff_max_backdate_days")
    .maybeSingle()
  return {
    staffMaxDiscountPercent: Number(data?.staff_max_discount_percent ?? 10),
    staffMaxBackdateDays: Number(data?.staff_max_backdate_days ?? 7),
  }
}

// Estado actual de cada línea (vista: no se puede incrustar en el select).
async function getItemStatuses(itemIds: string[]): Promise<Map<string, SaleItemStatus>> {
  if (!itemIds.length) return new Map()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("sale_item_current_status")
    .select("sale_item_id, status")
    .in("sale_item_id", itemIds)
  if (error) throw error
  return new Map(data.flatMap((row) => (row.sale_item_id && row.status ? [[row.sale_item_id, row.status]] : [])))
}

const SALE_LIST_COLUMNS = `id, number, occurred_at, channel, total_usd, is_backdated, created_at,
  customer:customers(first_name, last_name),
  items:sale_items(id, quantity, source, parent_item_id, variant:product_variants(sku, product:products(name)))`

export async function listSales(
  filters: SalesFilters | { customerId: string }
): Promise<SaleListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase.from("sales").select(SALE_LIST_COLUMNS).order("occurred_at", { ascending: false }).limit(200)

  if ("customerId" in filters) {
    query = query.eq("customer_id", filters.customerId)
  } else {
    const { from, to } = caracasMonthRange(filters.month)
    query = query.gte("occurred_at", from).lt("occurred_at", to)
    if (filters.channel) query = query.eq("channel", filters.channel)
  }

  const { data, error } = await query
  if (error) throw error
  if (!data.length) return []

  const ids = data.map((s) => s.id)
  const madeToOrderIds = data.flatMap((s) => s.items.filter((i) => i.source === "made_to_order").map((i) => i.id))
  const [{ data: summaries, error: summaryError }, statuses] = await Promise.all([
    supabase.from("sales_summary").select("sale_id, balance_usd, payment_status").in("sale_id", ids),
    getItemStatuses(madeToOrderIds),
  ])
  if (summaryError) throw summaryError

  const summary = new Map((summaries ?? []).map((s) => [s.sale_id, s]))
  // Por encargo que aún no está listo.
  const inProduction = new Set(
    data
      .filter((sale) =>
        sale.items.some((i) => i.source === "made_to_order" && !["ready", "delivered"].includes(statuses.get(i.id) ?? "ready"))
      )
      .map((sale) => sale.id)
  )

  const rows = data.map((sale) => {
    const s = summary.get(sale.id)
    return {
      id: sale.id,
      number: sale.number,
      occurredAt: sale.occurred_at,
      channel: sale.channel,
      customerName: fullName(sale.customer),
      totalUsd: Number(sale.total_usd),
      balanceUsd: Number(s?.balance_usd ?? 0),
      paymentStatus: (s?.payment_status ?? "pending") as PaymentStatus,
      // Los componentes de un combo no se repiten: el combo ya los resume.
      itemsSummary: sale.items
        .filter((i) => !i.parent_item_id)
        .map((i) => `${Number(i.quantity)} × ${i.variant?.product?.name ?? i.variant?.sku ?? "—"}`)
        .join(", "),
      pendingProduction: inProduction.has(sale.id),
      isBackdated: sale.is_backdated,
      createdAt: sale.created_at,
    }
  })

  const status = "customerId" in filters ? undefined : filters.status
  return status ? rows.filter((r) => r.paymentStatus === status) : rows
}

// Totales del mes: la vista solo devuelve filas a owner y admin (RLS).
export async function getSalesTotals(month: string): Promise<SalesTotals | null> {
  const supabase = await createSupabaseServerClient()
  const { from, to } = caracasMonthRange(month)
  const { data, error } = await supabase
    .from("sales_daily_totals")
    .select("*")
    .gte("sale_date", from.slice(0, 10))
    .lt("sale_date", to.slice(0, 10))
  if (error) throw error
  if (!data.length) return null
  return data.reduce<SalesTotals>(
    (acc, day) => ({
      salesCount: acc.salesCount + Number(day.sales_count ?? 0),
      totalUsd: acc.totalUsd + Number(day.total_usd ?? 0),
      paidUsd: acc.paidUsd + Number(day.paid_usd ?? 0),
      balanceUsd: acc.balanceUsd + Number(day.balance_usd ?? 0),
      collectedUsdt: acc.collectedUsdt + Number(day.collected_usdt ?? 0),
    }),
    { salesCount: 0, totalUsd: 0, paidUsd: 0, balanceUsd: 0, collectedUsdt: 0 }
  )
}

export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data: sale, error } = await supabase
    .from("sales")
    .select(
      `*, customer:customers(id, first_name, last_name, phone),
       price_method:payment_methods(name),
       author:profiles!sales_created_by_fkey(full_name),
       discounter:profiles!sales_discount_by_fkey(full_name)`
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!sale) return null

  const [itemsResult, paymentsResult, summaryResult, voidResult, editsResult, orderResult, cancellationResult] = await Promise.all([
    supabase
      .from("sale_items")
      .select(
        `id, parent_item_id, quantity, unit_price_usd, line_total_usd, source,
         variant:product_variants(sku, gender, color:colors(name), size:sizes(name), product:products(name)),
         customizations:sale_item_customizations(id, quantity, text, position, note, logo_path, charged, line_total_usd,
           type:customization_types(name), names:sale_item_customization_names(ordinal, name))`
      )
      .eq("sale_id", id)
      .order("created_at"),
    supabase
      .from("sale_payments_all")
      .select(
        `id, payment_method_id, ledger_entry_id, currency, amount, applied_rate, usd_amount, usdt_value, occurred_at, receipt_path, is_backdated,
         method:payment_methods(name), author:profiles!sale_payments_created_by_fkey(full_name),
         correction:sale_payment_corrections!sale_payment_corrections_payment_id_fkey(edit_id)`
      )
      .eq("sale_id", id)
      .order("occurred_at"),
    supabase.from("sales_summary").select("paid_usd, balance_usd, payment_status").eq("sale_id", id).maybeSingle(),
    supabase
      .from("sale_voids")
      .select("reason, created_at, author:profiles!sale_voids_created_by_fkey(full_name)")
      .eq("sale_id", id)
      .maybeSingle(),
    supabase
      .from("sale_edits")
      .select("id, reason, changes, created_at, author:profiles!sale_edits_created_by_fkey(full_name)")
      .eq("sale_id", id)
      .order("created_at"),
    supabase.from("orders").select("sale_id").eq("sale_id", id).maybeSingle(),
    supabase.from("order_cancellations").select("sale_id").eq("sale_id", id).maybeSingle(),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (paymentsResult.error) throw paymentsResult.error
  if (editsResult.error) throw editsResult.error
  const statuses = await getItemStatuses(itemsResult.data.map((i) => i.id))

  return {
    id: sale.id,
    number: sale.number,
    occurredAt: sale.occurred_at,
    channel: sale.channel,
    deliveryMethod: sale.delivery_method,
    priceMethodName: sale.price_method?.name ?? "—",
    customer: sale.customer
      ? { id: sale.customer.id, name: fullName(sale.customer) ?? "", phone: sale.customer.phone }
      : null,
    subtotalUsd: Number(sale.subtotal_usd),
    volumeDiscount:
      Number(sale.volume_discount_usd) > 0
        ? { percent: Number(sale.volume_discount_percent), usd: Number(sale.volume_discount_usd) }
        : null,
    discount:
      Number(sale.discount_usd) > 0 && sale.discount_type
        ? {
            type: sale.discount_type,
            value: Number(sale.discount_value),
            usd: Number(sale.discount_usd),
            reason: sale.discount_reason ?? "",
            byName: sale.discounter?.full_name ?? null,
          }
        : null,
    deliveryFeeUsd: Number(sale.delivery_fee_usd),
    isOrder: Boolean(orderResult.data),
    isCancelledOrder: Boolean(cancellationResult.data),
    vat: Number(sale.vat_usd) > 0 ? { percent: Number(sale.vat_percent), usd: Number(sale.vat_usd) } : null,
    totalUsd: Number(sale.total_usd),
    paidUsd: Number(summaryResult.data?.paid_usd ?? 0),
    balanceUsd: Number(summaryResult.data?.balance_usd ?? sale.total_usd),
    paymentStatus: (summaryResult.data?.payment_status ?? "pending") as PaymentStatus,
    bcvUsdRate: Number(sale.bcv_usd_rate),
    notes: sale.notes,
    isBackdated: sale.is_backdated,
    createdAt: sale.created_at,
    authorName: sale.author?.full_name ?? null,
    items: withComponentsAfterCombo(itemsResult.data).map((item) => ({
      id: item.id,
      parentId: item.parent_item_id,
      sku: item.variant?.sku ?? "—",
      productName: item.variant?.product?.name ?? "—",
      variantLabel: item.variant ? variantLabel(item.variant) : "",
      quantity: Number(item.quantity),
      unitPriceUsd: Number(item.unit_price_usd),
      lineTotalUsd: Number(item.line_total_usd),
      source: item.source,
      status: statuses.get(item.id) ?? null,
      customizations: item.customizations.map((c) => ({
        id: c.id,
        typeName: c.type?.name ?? "—",
        quantity: Number(c.quantity),
        text: c.text,
        names: [...c.names].sort((a, b) => a.ordinal - b.ordinal).map((n) => n.name),
        hasLogo: Boolean(c.logo_path),
        position: c.position,
        note: c.note,
        charged: c.charged,
        lineTotalUsd: Number(c.line_total_usd),
      })),
    })),
    // Los pagos corregidos no cuentan: quedan en el historial de cambios.
    payments: paymentsResult.data.filter((p) => !p.correction).map((p) => ({
      id: p.id,
      methodId: p.payment_method_id,
      ledgerEntryId: p.ledger_entry_id,
      methodName: p.method?.name ?? "—",
      currency: p.currency,
      amount: Number(p.amount),
      appliedRate: p.applied_rate === null ? null : Number(p.applied_rate),
      usdAmount: Number(p.usd_amount),
      usdtValue: Number(p.usdt_value),
      occurredAt: p.occurred_at,
      authorName: p.author?.full_name ?? null,
      hasReceipt: Boolean(p.receipt_path),
      isBackdated: p.is_backdated,
    })),
    void: voidResult.data
      ? { reason: voidResult.data.reason, at: voidResult.data.created_at, byName: voidResult.data.author?.full_name ?? null }
      : null,
    edits: editsResult.data.map((e) => ({
      id: e.id,
      at: e.created_at,
      byName: e.author?.full_name ?? null,
      reason: e.reason,
      changes: e.changes as SaleEditChange[],
    })),
  }
}

// Cuentas por cobrar agrupadas por cliente (la vista solo devuelve filas a owner y admin).
// Ventas con saldo por cobrar (para el contador del menú).
export async function countReceivables(): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { count, error } = await supabase.from("receivables").select("sale_id", { count: "exact", head: true })
  if (error) throw error
  return count ?? 0
}

export async function listReceivables(): Promise<ReceivableGroup[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("receivables").select("*").order("occurred_at")
  if (error) throw error

  const groups = new Map<string, ReceivableGroup>()
  for (const row of data) {
    const key = row.customer_id ?? "none"
    const group = groups.get(key) ?? {
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      balanceUsd: 0,
      oldestDays: 0,
      sales: [],
    }
    group.balanceUsd += Number(row.balance_usd ?? 0)
    group.oldestDays = Math.max(group.oldestDays, Number(row.days_outstanding ?? 0))
    group.sales.push({
      saleId: row.sale_id!,
      number: Number(row.number),
      occurredAt: row.occurred_at!,
      totalUsd: Number(row.total_usd),
      balanceUsd: Number(row.balance_usd),
      daysOutstanding: Number(row.days_outstanding ?? 0),
    })
    groups.set(key, group)
  }
  // Primero quien debe hace más tiempo.
  return [...groups.values()].sort((a, b) => b.oldestDays - a.oldestDays || b.balanceUsd - a.balanceUsd)
}
