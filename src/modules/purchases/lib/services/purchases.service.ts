import "server-only"

import { ensureRatesForDate } from "@/modules/treasury/lib/services/rate-history.service"

import type { Currency } from "@/common/lib/constants/currency.constants"
import { fetchAll } from "@/common/lib/db/fetch-all.util"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { caracasMonthRange, caracasNoonIso, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { listCategories } from "@/modules/money-movements/lib/services/movement-categories.service"
import { getSalesSettings } from "@/modules/sales/lib/services/sales.service"
import { listAccounts } from "@/modules/treasury/lib/services/accounts.service"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

import { PURCHASE_CATEGORY_TYPES, type PurchaseStatus } from "../constants/purchases.constants"
import type { AddPurchasePaymentInput, CreatePurchaseInput } from "../schemas/purchases.schema"
import type {
  PayableItem,
  PurchaseDetail,
  PurchaseFilters,
  PurchaseFormData,
  PurchaseListItem,
} from "../types/purchases.types"
import { variantLabel } from "@/modules/products/lib/utils/variant-label.util"

// Fecha del formulario → instante (vacío u hoy = ahora).
const occurredAt = (date?: string) => (date && date !== toCaracasDate() ? caracasNoonIso(date) : undefined)

export async function getPurchaseFormData(): Promise<PurchaseFormData> {
  const supabase = await createSupabaseServerClient()
  const [suppliers, variants, balances, accounts, categories, rateStatus, settings] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    fetchAll((from, to) =>
    supabase
      .from("product_variants")
      .select(
        "id, sku, unit_cost_usdt, gender, color:colors(name), size:sizes(name), product:products!inner(name, kind, unit, is_active, fulfillment_type)"
      )
      .eq("is_active", true)
      .eq("product.is_active", true)
      .neq("product.fulfillment_type", "made_to_order")
      .order("sku")
      .range(from, to)
    ),
    fetchAll((from, to) => supabase.from("stock_balances").select("variant_id, quantity").order("variant_id").range(from, to)),
    listAccounts({ activeOnly: true }),
    listCategories({ activeOnly: true }),
    getRateStatus(),
    getSalesSettings(),
  ])
  if (suppliers.error) throw suppliers.error
  if (variants.error) throw variants.error

  const stock = new Map((balances.data ?? []).map((b) => [b.variant_id, Number(b.quantity ?? 0)]))
  const rate = rateStatus.rate

  return {
    suppliers: suppliers.data,
    // Materia prima primero: es lo que más se compra.
    variants: variants.data
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        productName: v.product.name,
        variantLabel: variantLabel(v),
        isRawMaterial: v.product.kind === "raw_material",
        unit: v.product.unit,
        stock: stock.get(v.id) ?? 0,
        lastCostUsdt: v.unit_cost_usdt === null ? null : Number(v.unit_cost_usdt),
      }))
      .sort((a, b) => Number(b.isRawMaterial) - Number(a.isRawMaterial) || a.productName.localeCompare(b.productName, "es")),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    // RLS ya filtra lo que staff puede usar; aquí, solo las que aplican a compras.
    categories: categories
      .filter((c) => (PURCHASE_CATEGORY_TYPES as readonly string[]).includes(c.type))
      .map((c) => ({ id: c.id, name: c.name, type: c.type })),
    rates: rate
      ? {
          bcvUsd: Number(rate.bcv_usd),
          binance: Number(rate.binance_usdt),
          usdUsdt: Number(rate.usd_usdt),
          isCurrent: rateStatus.hasTodayRate,
        }
      : null,
    staffMaxBackdateDays: settings.staffMaxBackdateDays,
    today: rateStatus.today,
  }
}

export async function createPurchase(input: CreatePurchaseInput) {
  await ensureRatesForDate(input.date)
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("create_purchase", {
    p_supplier_id: input.supplier_id,
    p_items: input.items,
    p_payments: input.payments,
    p_due_date: input.due_date ?? undefined,
    p_notes: input.notes ?? undefined,
    p_receipt_path: input.receipt_path ?? undefined,
    p_occurred_at: occurredAt(input.date),
  })
}

export async function addPurchasePayment(input: AddPurchasePaymentInput) {
  await ensureRatesForDate(input.date)
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("add_purchase_payment", {
    p_purchase_id: input.purchase_id,
    p_account_id: input.account_id,
    p_amount: input.amount,
    p_rate_kind: input.rate_kind,
    p_receipt_path: input.receipt_path,
    p_occurred_at: occurredAt(input.date),
  })
}

export async function voidPurchase(purchaseId: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("void_purchase", { p_purchase_id: purchaseId, p_reason: reason })
}

const LIST_COLUMNS = `id, number, occurred_at, created_at, is_backdated, total_usd, due_date,
  supplier:suppliers(name),
  items:purchase_items(quantity, line_type, description, variant:product_variants(sku, product:products(name)))`

// RLS: staff recibe solo sus compras.
export async function listPurchases(filters: PurchaseFilters | { supplierId: string }): Promise<PurchaseListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase.from("purchases").select(LIST_COLUMNS).order("occurred_at", { ascending: false }).limit(200)

  if ("month" in filters) {
    const { from, to } = caracasMonthRange(filters.month)
    query = query.gte("occurred_at", from).lt("occurred_at", to)
  }
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId)

  const { data, error } = await query
  if (error) throw error
  if (!data.length) return []

  const { data: summaries, error: summaryError } = await supabase
    .from("purchases_summary")
    .select("purchase_id, balance_usd, payment_status")
    .in(
      "purchase_id",
      data.map((p) => p.id)
    )
  if (summaryError) throw summaryError
  const summary = new Map((summaries ?? []).map((s) => [s.purchase_id, s]))

  const rows = data.map((p) => {
    const s = summary.get(p.id)
    return {
      id: p.id,
      number: p.number,
      occurredAt: p.occurred_at,
      createdAt: p.created_at,
      isBackdated: p.is_backdated,
      supplierName: p.supplier?.name ?? "—",
      totalUsd: Number(p.total_usd),
      balanceUsd: Number(s?.balance_usd ?? 0),
      dueDate: p.due_date,
      status: (s?.payment_status ?? "pending") as PurchaseStatus,
      itemsSummary: p.items
        .map((i) =>
          i.line_type === "concept" ? i.description : `${Number(i.quantity)} × ${i.variant?.product?.name ?? i.variant?.sku ?? "—"}`
        )
        .join(", "),
    }
  })
  const status = "status" in filters ? filters.status : undefined
  return status ? rows.filter((r) => r.status === status) : rows
}

// Compras con saldo por pagar (para el contador del menú).
export async function countPayables(): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { count, error } = await supabase.from("payables").select("purchase_id", { count: "exact", head: true })
  if (error) throw error
  return count ?? 0
}

export async function listPayables(): Promise<PayableItem[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("payables")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("occurred_at")
  if (error) throw error
  return data.map((p) => ({
    purchaseId: p.purchase_id!,
    number: Number(p.number),
    supplierId: p.supplier_id!,
    supplierName: p.supplier_name ?? "—",
    occurredAt: p.occurred_at!,
    dueDate: p.due_date,
    totalUsd: Number(p.total_usd),
    balanceUsd: Number(p.balance_usd),
    daysOverdue: p.days_overdue === null ? null : Number(p.days_overdue),
  }))
}

export async function getPurchaseDetail(id: string): Promise<PurchaseDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("*, supplier:suppliers(id, name), author:profiles!purchases_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!purchase) return null

  const [items, payments, summary, voided] = await Promise.all([
    supabase
      .from("purchase_items")
      .select(
        `id, line_type, description, quantity, unit_cost_usd, line_total_usd,
         category:movement_categories(name),
         variant:product_variants(sku, gender, color:colors(name), size:sizes(name), product:products(name))`
      )
      .eq("purchase_id", id)
      .order("created_at"),
    supabase
      .from("purchase_payments")
      .select(
        `id, currency, amount, rate_kind, applied_rate, usd_amount, usdt_value, occurred_at, is_backdated,
         account:accounts(name), author:profiles!purchase_payments_created_by_fkey(full_name)`
      )
      .eq("purchase_id", id)
      .order("occurred_at"),
    supabase.from("purchases_summary").select("paid_usd, balance_usd, payment_status").eq("purchase_id", id).maybeSingle(),
    supabase
      .from("purchase_voids")
      .select("reason, created_at, author:profiles!purchase_voids_created_by_fkey(full_name)")
      .eq("purchase_id", id)
      .maybeSingle(),
  ])
  if (items.error) throw items.error
  if (payments.error) throw payments.error

  return {
    id: purchase.id,
    number: purchase.number,
    occurredAt: purchase.occurred_at,
    createdAt: purchase.created_at,
    isBackdated: purchase.is_backdated,
    supplier: { id: purchase.supplier?.id ?? purchase.supplier_id, name: purchase.supplier?.name ?? "—" },
    totalUsd: Number(purchase.total_usd),
    paidUsd: Number(summary.data?.paid_usd ?? 0),
    balanceUsd: Number(summary.data?.balance_usd ?? purchase.total_usd),
    status: (summary.data?.payment_status ?? "pending") as PurchaseStatus,
    dueDate: purchase.due_date,
    notes: purchase.notes,
    hasReceipt: Boolean(purchase.receipt_path),
    authorName: purchase.author?.full_name ?? null,
    rates: {
      bcvUsd: Number(purchase.bcv_usd_rate),
      binance: Number(purchase.binance_rate),
      usdUsdt: Number(purchase.usd_usdt_rate),
    },
    items: items.data.map((i) => ({
      id: i.id,
      lineType: i.line_type,
      label:
        i.line_type === "concept"
          ? (i.description ?? "—")
          : `${i.variant?.product?.name ?? "—"} · ${i.variant ? variantLabel(i.variant) : ""}`,
      sku: i.variant?.sku ?? null,
      categoryName: i.category?.name ?? "—",
      quantity: Number(i.quantity),
      unitCostUsd: Number(i.unit_cost_usd),
      lineTotalUsd: Number(i.line_total_usd),
    })),
    payments: payments.data.map((p) => ({
      id: p.id,
      accountName: p.account?.name ?? "—",
      currency: p.currency as Currency,
      amount: Number(p.amount),
      rateKind: p.rate_kind,
      appliedRate: p.applied_rate === null ? null : Number(p.applied_rate),
      usdAmount: Number(p.usd_amount),
      usdtValue: Number(p.usdt_value),
      occurredAt: p.occurred_at,
      isBackdated: p.is_backdated,
      authorName: p.author?.full_name ?? null,
    })),
    void: voided.data
      ? { reason: voided.data.reason, at: voided.data.created_at, byName: voided.data.author?.full_name ?? null }
      : null,
  }
}
