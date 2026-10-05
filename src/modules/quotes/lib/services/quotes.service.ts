import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"
import { getOrderFormData } from "@/modules/orders/lib/services/orders.service"

import { QUOTE_LIST_LIMIT } from "../constants/quotes.constants"
import type { ConvertQuoteInput, QuoteFilters, SaveQuoteInput } from "../schemas/quote.schema"
import type { QuoteDetail, QuoteFormData, QuoteItem, QuoteListItem, QuoteStatus } from "../types/quotes.types"
import { getQuoteSettings, listPriceLists } from "./quote-settings.service"

const num = (value: number | string | null | undefined) => Number(value ?? 0)

// Un enviado cuya fecha pasó ya está vencido (igual que quote_effective_status en la base).
const effectiveStatus = (status: QuoteStatus, validUntil: string, today: string): QuoteStatus =>
  status === "sent" && validUntil < today ? "expired" : status

export async function getQuoteFormData(): Promise<QuoteFormData> {
  const [order, settings, priceLists] = await Promise.all([getOrderFormData(), getQuoteSettings(), listPriceLists()])
  return {
    variants: order.variants,
    rates: order.rates,
    staffMaxDiscountPercent: order.staffMaxDiscountPercent,
    volumeTiers: order.volumeTiers,
    today: order.today,
    customizationTypes: order.customizationTypes,
    customizationTiers: order.customizationTiers,
    priceLists,
    settings,
  }
}

// Crea (sin id) o guarda un borrador. La base calcula precios y totales.
export async function saveQuoteDraft(input: SaveQuoteInput) {
  const supabase = await createSupabaseServerClient()
  const { id, ...payload } = input
  return supabase.rpc("save_quote_draft", { p_quote_id: id, p_payload: payload })
}

export async function sendQuote(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("send_quote", { p_quote_id: id })
}

export async function markQuote(id: string, status: "accepted" | "rejected", note: string | null) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("mark_quote", { p_quote_id: id, p_status: status, p_note: note ?? undefined })
}

export async function discardQuote(id: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("discard_quote", { p_quote_id: id, p_reason: reason })
}

export async function newQuoteVersion(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("new_quote_version", { p_quote_id: id })
}

// Convierte un presupuesto aceptado en pedido (la base copia precios y verifica que el total coincida).
export async function convertQuoteToOrder(input: ConvertQuoteInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("convert_quote_to_order", {
    p_quote_id: input.id,
    p_customer_id: input.customer_id,
    p_currency: input.currency,
    p_stock_mode: input.stock_mode,
    p_promised_date: input.promised_date,
    p_channel: input.channel,
    p_delivery_method: input.delivery_method,
    p_details: input.details,
  })
}

export async function duplicateQuote(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("duplicate_quote", { p_quote_id: id })
}

// Quita lo que rompería el filtro de PostgREST.
const sanitize = (value: string) => value.replace(/[,()%*"\\]/g, " ").trim()

export async function listQuotes(filters: QuoteFilters = {}): Promise<QuoteListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("quotes_overview")
    .select("*")
    .order("issued_on", { ascending: false })
    .order("number", { ascending: false })
    .order("version", { ascending: false })
    .limit(QUOTE_LIST_LIMIT)
  if (filters.status) query = query.eq("effective_status", filters.status)
  if (filters.from) query = query.gte("issued_on", filters.from)
  if (filters.to) query = query.lte("issued_on", filters.to)
  const term = sanitize(filters.q ?? "")
  if (term) query = query.or(`code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_legal_name.ilike.%${term}%`)

  const { data, error } = await query
  if (error) throw error
  // Las columnas de una vista llegan como opcionales en los tipos; en la tabla no lo son.
  return data.map((q) => ({
    id: q.id ?? "",
    code: q.code ?? "",
    status: q.status ?? "draft",
    effectiveStatus: q.effective_status ?? q.status ?? "draft",
    customerName: q.customer_name ?? "",
    customerLegalName: q.customer_legal_name,
    issuedOn: q.issued_on ?? "",
    validUntil: q.valid_until ?? "",
    currencies: q.currencies ?? "usd",
    usdTotal: num(q.usd_total),
    vesTotalBs: num(q.ves_total_bs),
    createdByName: q.created_by_name ?? "",
    orderSaleId: q.order_sale_id,
  }))
}

export async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
  const supabase = await createSupabaseServerClient()
  const [quoteResult, itemsResult, eventsResult] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "*, usd_list:payment_methods!quotes_usd_price_method_id_fkey(id, name), ves_list:payment_methods!quotes_ves_price_method_id_fkey(id, name), order:sales!quotes_order_sale_id_fkey(number)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("quote_items")
      .select("*, customizations:quote_item_customizations(*)")
      .eq("quote_id", id)
      .order("position"),
    supabase
      .from("quote_status_events")
      .select("id, status, note, created_at, author:profiles!quote_status_events_created_by_fkey(full_name)")
      .eq("quote_id", id)
      .order("created_at"),
  ])
  if (quoteResult.error) throw quoteResult.error
  const q = quoteResult.data
  if (!q) return null

  const items: QuoteItem[] = (itemsResult.data ?? []).map((i) => ({
    id: i.id,
    parentId: i.parent_item_id,
    kind: i.kind,
    variantId: i.variant_id,
    productName: i.product_name,
    sku: i.sku,
    colorName: i.color_name,
    sizeName: i.size_name,
    sizeSort: i.size_sort,
    quantity: num(i.quantity),
    discountPercent: num(i.discount_percent),
    usdUnitPrice: num(i.usd_unit_price),
    vesUnitPrice: num(i.ves_unit_price),
    usdLineTotal: num(i.usd_line_total),
    vesLineTotal: num(i.ves_line_total),
    customizations: (i.customizations ?? []).map((c) => ({
      id: c.id,
      typeId: c.customization_type_id,
      typeName: c.type_name,
      quantity: num(c.quantity),
      sizeCm: c.size_cm === null ? null : num(c.size_cm),
      position: c.position,
      text: c.text,
      note: c.note,
      unitPriceUsd: num(c.unit_price_usd),
      discountPercent: num(c.discount_percent),
      lineTotalUsd: num(c.line_total_usd),
    })),
  }))

  return {
    id: q.id,
    code: q.code,
    number: q.number,
    version: q.version,
    status: q.status,
    effectiveStatus: effectiveStatus(q.status, q.valid_until, toCaracasDate()),
    customerId: q.customer_id,
    customer: {
      kind: q.customer_kind,
      name: q.customer_name,
      legalName: q.customer_legal_name,
      taxId: q.customer_tax_id,
      phone: q.customer_phone,
      email: q.customer_email,
      address: q.customer_address,
      contactPerson: q.customer_contact_person,
    },
    issuedOn: q.issued_on,
    validUntil: q.valid_until,
    currencies: q.currencies,
    usdPriceList: q.usd_list ? { id: q.usd_list.id, name: q.usd_list.name } : null,
    vesPriceList: q.ves_list ? { id: q.ves_list.id, name: q.ves_list.name } : null,
    vesRate: q.ves_rate === null ? null : num(q.ves_rate),
    vatEnabled: q.vat_enabled,
    vatPercent: num(q.vat_percent),
    igtfNoteEnabled: q.igtf_note_enabled,
    igtfNote: q.igtf_note,
    discount: q.discount_type && q.discount_value ? { type: q.discount_type, value: num(q.discount_value), reason: q.discount_reason } : null,
    discountReason: q.discount_reason,
    groupBySize: q.group_by_size,
    terms: q.terms,
    headerImagePath: q.header_image_path,
    pieces: num(q.pieces),
    volumeDiscountPercent: num(q.volume_discount_percent),
    customizationTotalUsd: num(q.customization_total_usd),
    usd: {
      subtotal: num(q.usd_subtotal),
      volumeDiscount: num(q.usd_volume_discount),
      lineDiscounts: num(q.usd_line_discounts),
      discount: num(q.usd_discount),
      vat: num(q.usd_vat),
      total: num(q.usd_total),
    },
    ves: {
      subtotal: num(q.ves_subtotal),
      volumeDiscount: num(q.ves_volume_discount),
      lineDiscounts: num(q.ves_line_discounts),
      discount: num(q.ves_discount),
      vat: num(q.ves_vat),
      total: num(q.ves_total),
      totalBs: num(q.ves_total_bs),
    },
    createdBy: { name: q.created_by_name, email: q.created_by_email, phone: q.created_by_phone },
    createdAt: q.created_at,
    replacesId: q.replaces_id,
    supersededBy: q.superseded_by,
    duplicatedFrom: q.duplicated_from,
    orderSaleId: q.order_sale_id,
    orderNumber: q.order?.number ?? null,
    pdfPath: q.pdf_path,
    items,
    events: (eventsResult.data ?? []).map((e) => ({
      id: e.id,
      status: e.status,
      note: e.note,
      at: e.created_at,
      byName: e.author?.full_name ?? null,
    })),
  }
}
