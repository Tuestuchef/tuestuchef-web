import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"
import { getSaleFormData } from "@/modules/sales/lib/services/sales.service"

import { OPEN_ORDER_STATUSES, type OrderStatus, type ProductionStage } from "../constants/orders.constants"
import type { CancelOrderInput, CreateOrderInput, OrderSettingsInput } from "../schemas/orders.schema"
import type { Assignee, OrderDetail, OrderFormData, OrderListItem, OrderSettings } from "../types/orders.types"
import { listCustomizationTypes } from "./order-settings.service"

const variantLabel = (v: { color: { name: string } | null; size: { name: string } | null } | null) =>
  v ? [v.color?.name, v.size?.name].filter(Boolean).join(" · ") || "Única" : ""

const fullName = (c: { first_name: string; last_name: string | null } | null) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null

const today = () => toCaracasDate()

export async function getOrderSettings(): Promise<OrderSettings> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("order_settings").select("*").maybeSingle()
  return {
    depositThresholdUsd: Number(data?.deposit_threshold_usd ?? 500),
    depositPercent: Number(data?.deposit_percent ?? 60),
    defaultLeadDays: data?.default_lead_days ?? 5,
  }
}

export async function updateOrderSettings(input: OrderSettingsInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("order_settings").update(input).eq("id", true).select("id").single()
}

export async function getOrderFormData(): Promise<OrderFormData> {
  const supabase = await createSupabaseServerClient()
  const [sale, types, settings, tiers, quoteSettings] = await Promise.all([
    getSaleFormData(),
    listCustomizationTypes(),
    getOrderSettings(),
    supabase.from("volume_discount_tiers").select("min_quantity, percent").eq("scope", "customization").order("min_quantity"),
    supabase.from("quote_settings").select("vat_percent").maybeSingle(),
  ])
  return {
    ...sale,
    customizationTypes: types.filter((t) => t.isActive),
    customizationTiers: (tiers.data ?? []).map((t) => ({ minQuantity: t.min_quantity, percent: Number(t.percent) })),
    settings,
    vatPercent: Number(quoteSettings.data?.vat_percent ?? 0),
  }
}

export async function createOrder(input: CreateOrderInput) {
  const supabase = await createSupabaseServerClient()
  // La tasa de IVA es la de la configuración, nunca la que mande el navegador.
  const vatPercent = input.vat_enabled ? (await supabase.from("quote_settings").select("vat_percent").single()).data?.vat_percent : 0
  return supabase.rpc("create_order", {
    p_customer_id: input.customer_id,
    p_price_method_id: input.price_method_id,
    p_channel: input.channel,
    p_delivery_method: input.delivery_method,
    p_items: input.items,
    p_stock_mode: input.stock_mode,
    p_promised_date: input.promised_date,
    p_payments: input.payments,
    p_delivery_fee_usd: input.delivery_fee_usd,
    p_notes: input.notes ?? undefined,
    p_vat_percent: Number(vatPercent ?? 0),
  })
}

// Pedidos abiertos: por empezar, en producción o listos para entregar.
export async function countOpenOrders(): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { count, error } = await supabase.from("orders_overview").select("sale_id", { count: "exact", head: true }).in("status", OPEN_ORDER_STATUSES)
  if (error) throw error
  return count ?? 0
}

export async function listOrders(filters: { status?: OrderStatus | "late" | "open" } = {}): Promise<OrderListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase.from("orders_overview").select("*").order("promised_date").limit(300)
  if (filters.status === "late") query = query.eq("is_late", true)
  else if (filters.status === "open" || !filters.status) query = query.in("status", OPEN_ORDER_STATUSES)
  else query = query.eq("status", filters.status)

  const { data, error } = await query
  if (error) throw error
  if (!data.length) return []

  const ids = data.map((o) => o.sale_id!)
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, customer:customers(first_name, last_name), items:sale_items(quantity, parent_item_id, variant:product_variants(product:products(name)))")
    .in("id", ids)
  if (salesError) throw salesError
  const byId = new Map(sales.map((s) => [s.id, s]))

  return data.map((o) => {
    const sale = byId.get(o.sale_id!)
    return {
      saleId: o.sale_id!,
      number: o.number!,
      customerName: fullName(sale?.customer ?? null),
      occurredAt: o.occurred_at!,
      promisedDate: o.promised_date!,
      status: o.status as OrderStatus,
      isLate: Boolean(o.is_late),
      totalUsd: Number(o.total_usd),
      balanceUsd: Number(o.balance_usd),
      canStart: Boolean(o.can_start),
      itemsSummary: (sale?.items ?? [])
        .filter((i) => !i.parent_item_id)
        .map((i) => `${Number(i.quantity)} × ${i.variant?.product?.name ?? "—"}`)
        .join(", "),
    }
  })
}

export async function getOrderDetail(saleId: string): Promise<OrderDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data: overview } = await supabase.from("orders_overview").select("*").eq("sale_id", saleId).maybeSingle()
  if (!overview) return null

  const [order, sale, items, overrides, cancellation, dateChanges, fromQuote] = await Promise.all([
    supabase.from("orders").select("stock_mode, delivered_at").eq("sale_id", saleId).single(),
    supabase.from("sales").select("vat_percent, vat_usd, customer:customers(id, first_name, last_name, phone)").eq("id", saleId).single(),
    supabase
      .from("sale_items")
      .select(
        `id, parent_item_id, quantity, reserved_quantity, source, unit_price_usd, line_total_usd,
         variant:product_variants(sku, color:colors(name), size:sizes(name), product:products(name)),
         customizations:sale_item_customizations(id, quantity, text, position, size_cm, note, logo_path, line_total_usd,
           type:customization_types(name), names:sale_item_customization_names(ordinal, name)),
         assignments:production_assignments(stage, expected_date, completed_at, team_member:team_members(id, full_name), supplier:suppliers(id, name))`
      )
      .eq("sale_id", saleId)
      .order("created_at"),
    supabase.from("order_overrides").select("kind, reason, author:profiles!order_overrides_created_by_fkey(full_name)").eq("sale_id", saleId),
    supabase.from("order_cancellations").select("*").eq("sale_id", saleId).maybeSingle(),
    supabase.from("order_date_changes").select("*").eq("sale_id", saleId).order("created_at"),
    supabase.from("quotes").select("id, code").eq("order_sale_id", saleId).maybeSingle(),
  ])
  if (items.error) throw items.error

  const ids = items.data.map((i) => i.id)
  const [statuses, nexts] = await Promise.all([
    supabase.from("sale_item_current_status").select("sale_item_id, status").in("sale_item_id", ids),
    Promise.all(items.data.filter((i) => i.source !== "combo").map((i) => supabase.rpc("next_line_stage", { p_item_id: i.id }).then((r) => [i.id, r.data] as const))),
  ])
  const statusById = new Map((statuses.data ?? []).map((s) => [s.sale_item_id!, s.status as ProductionStage]))
  const nextById = new Map(nexts)
  const now = today()

  // Cada combo seguido de sus componentes.
  const ordered = items.data
    .filter((i) => !i.parent_item_id)
    .flatMap((i) => [i, ...items.data.filter((c) => c.parent_item_id === i.id)])

  const customer = sale.data?.customer ?? null
  return {
    saleId,
    number: overview.number!,
    status: overview.status as OrderStatus,
    isLate: Boolean(overview.is_late),
    occurredAt: overview.occurred_at!,
    promisedDate: overview.promised_date!,
    stockMode: order.data!.stock_mode,
    customer: customer ? { id: customer.id, name: fullName(customer) ?? "", phone: customer.phone } : null,
    totalUsd: Number(overview.total_usd),
    vat: Number(sale.data?.vat_usd ?? 0) > 0 ? { percent: Number(sale.data!.vat_percent), usd: Number(sale.data!.vat_usd) } : null,
    paidUsd: Number(overview.paid_usd),
    balanceUsd: Number(overview.balance_usd),
    depositRequiredUsd: Number(overview.deposit_required_usd),
    canStart: Boolean(overview.can_start),
    overrides: (overrides.data ?? []).map((o) => ({ kind: o.kind, reason: o.reason, byName: o.author?.full_name ?? null })),
    cancellation: cancellation.data
      ? {
          reason: cancellation.data.reason,
          deductionUsdt: Number(cancellation.data.deduction_usdt),
          refundedUsdt: Number(cancellation.data.refunded_usdt),
          at: cancellation.data.created_at,
        }
      : null,
    deliveredAt: order.data!.delivered_at,
    dateChanges: (dateChanges.data ?? []).map((d) => ({ previous: d.previous_date, next: d.new_date, reason: d.reason, at: d.created_at })),
    fromQuote: fromQuote.data ? { id: fromQuote.data.id, code: fromQuote.data.code } : null,
    lines: ordered.map((item) => {
      const stage = statusById.get(item.id) ?? null
      const open = item.assignments.find((a) => a.stage === stage && !a.completed_at)
      const assignee: Assignee | null = open?.team_member
        ? { kind: "member", id: open.team_member.id, name: open.team_member.full_name }
        : open?.supplier
          ? { kind: "workshop", id: open.supplier.id, name: open.supplier.name }
          : null
      return {
        id: item.id,
        parentId: item.parent_item_id,
        productName: item.variant?.product?.name ?? "—",
        variantLabel: item.source === "combo" ? "Combo" : variantLabel(item.variant),
        sku: item.variant?.sku ?? "—",
        quantity: Number(item.quantity),
        reservedQuantity: Number(item.reserved_quantity),
        isCombo: item.source === "combo",
        stage,
        nextStage: (nextById.get(item.id) as ProductionStage | null | undefined) ?? null,
        lineTotalUsd: Number(item.line_total_usd),
        unitPriceUsd: Number(item.unit_price_usd),
        customizations: item.customizations.map((c) => ({
          id: c.id,
          typeName: c.type?.name ?? "—",
          quantity: Number(c.quantity),
          text: c.text,
          names: [...c.names].sort((a, b) => a.ordinal - b.ordinal).map((n) => n.name),
          position: c.position,
          sizeCm: c.size_cm === null ? null : Number(c.size_cm),
          note: c.note,
          hasLogo: Boolean(c.logo_path),
          lineTotalUsd: Number(c.line_total_usd),
        })),
        assignee: assignee
          ? {
              ...assignee,
              expectedDate: open?.expected_date ?? null,
              isLate: Boolean(assignee.kind === "workshop" && open?.expected_date && open.expected_date < now),
            }
          : null,
      }
    }),
  }
}

export async function advanceLine(itemId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: next, error } = await supabase.rpc("next_line_stage", { p_item_id: itemId })
  if (error) return { error }
  if (!next) return { error: { message: "Esta línea ya está lista: se entrega el pedido completo." } }
  return supabase.rpc("set_sale_item_status", { p_sale_item_id: itemId, p_status: next })
}

export async function assignStage(input: {
  itemId: string
  stage: ProductionStage
  assignee: Assignee["kind"]
  assigneeId: string
  expectedDate?: string
  note?: string
}) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("assign_stage", {
    p_sale_item_id: input.itemId,
    p_stage: input.stage,
    p_team_member_id: input.assignee === "member" ? input.assigneeId : undefined,
    p_supplier_id: input.assignee === "workshop" ? input.assigneeId : undefined,
    p_expected_date: input.expectedDate,
    p_note: input.note,
  })
}

export async function deliverOrder(saleId: string, reason?: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("deliver_order", { p_sale_id: saleId, p_reason: reason })
}

export async function cancelOrder(input: CancelOrderInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("cancel_order", { p_sale_id: input.sale_id, p_reason: input.reason, p_deduction_usdt: input.deduction_usdt })
}

export async function getCancellationQuote(saleId: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.rpc("order_cancellation_quote", { p_sale_id: saleId })
  const row = data?.[0]
  return row
    ? {
        paidUsdt: Number(row.paid_usdt),
        materialsUsdt: Number(row.materials_usdt),
        workshopsUsdt: Number(row.workshops_usdt),
        suggestedUsdt: Number(row.suggested_deduction_usdt),
        productionStarted: row.production_started,
      }
    : null
}

export async function changePromisedDate(saleId: string, date: string, reason?: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("change_order_promised_date", { p_sale_id: saleId, p_date: date, p_reason: reason })
}

export async function allowWithoutDeposit(saleId: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("allow_order_without_deposit", { p_sale_id: saleId, p_reason: reason })
}

// Personas y talleres a quienes se puede asignar una etapa.
export async function listAssignees(): Promise<Assignee[]> {
  const supabase = await createSupabaseServerClient()
  const [members, workshops] = await Promise.all([
    supabase.from("team_members").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).eq("kind", "workshop").order("name"),
  ])
  return [
    ...(members.data ?? []).map((m) => ({ kind: "member" as const, id: m.id, name: m.full_name })),
    ...(workshops.data ?? []).map((w) => ({ kind: "workshop" as const, id: w.id, name: w.name })),
  ]
}

