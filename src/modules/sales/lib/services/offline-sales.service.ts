import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { CreateSaleInput } from "../schemas/sales.schema"

type SyncData = { status: "created" | "duplicate" | "rejected"; sale_id?: string; error?: string }

// Mismos campos que create_sale, con la hora real de la venta.
const toPayload = (sale: CreateSaleInput, occurredAt: string) => ({
  channel: sale.channel,
  price_method_id: sale.price_method_id,
  delivery_method: sale.delivery_method,
  items: sale.items,
  payments: sale.payments,
  customer_id: sale.customer_id,
  delivery_fee_usd: sale.delivery_fee_usd,
  discount_type: sale.discount_value ? sale.discount_type : null,
  discount_value: sale.discount_value,
  discount_reason: sale.discount_reason,
  notes: sale.notes,
  delivered: sale.delivered,
  occurred_at: occurredAt,
})

export async function syncOfflineSale(clientRef: string, occurredAt: string, sale: CreateSaleInput) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("sync_offline_sale", { p_client_ref: clientRef, p_payload: toPayload(sale, occurredAt) })
  return { data: data as SyncData | null, error }
}

export async function retryOfflineSale(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("retry_offline_sale", { p_rejection_id: id })
  return { data: data as SyncData | null, error }
}

export async function discardOfflineSale(id: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("discard_offline_sale", { p_rejection_id: id, p_reason: reason })
}

export type OfflineRejection = {
  id: string
  occurredAt: string
  error: string
  attempts: number
  authorName: string | null
  itemsCount: number
  resolved: { at: string; saleId: string | null; note: string | null } | null
}

export async function listOfflineRejections(): Promise<OfflineRejection[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("offline_sale_rejections")
    .select("*, author:profiles!offline_sale_rejections_created_by_fkey(full_name)")
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return data.map((r) => {
    const payload = r.payload as { items?: unknown[] }
    return {
      id: r.id,
      occurredAt: r.occurred_at,
      error: r.error,
      attempts: r.attempts,
      authorName: r.author?.full_name ?? null,
      itemsCount: Array.isArray(payload.items) ? payload.items.length : 0,
      resolved: r.resolved_at ? { at: r.resolved_at, saleId: r.resolved_sale_id, note: r.resolution_note } : null,
    }
  })
}
