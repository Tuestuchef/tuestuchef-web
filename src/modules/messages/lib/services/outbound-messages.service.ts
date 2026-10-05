import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { MessageKind, OutboundMessage } from "../types/messages.types"

export async function logOutboundMessage(input: { kind: MessageKind; body: string; phone: string | null; customerId: string | null; saleId: string | null }) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("log_outbound_message", {
    p_kind: input.kind,
    p_body: input.body,
    p_phone: input.phone ?? undefined,
    p_customer_id: input.customerId ?? undefined,
    p_sale_id: input.saleId ?? undefined,
  })
}

// Mensajes de una venta o de un cliente (RLS: staff ve los suyos; owner y admin, todos).
export async function listOutboundMessages(filter: { saleId: string } | { customerId: string }): Promise<OutboundMessage[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("outbound_messages")
    .select("*, author:profiles!outbound_messages_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(30)
  query = "saleId" in filter ? query.eq("sale_id", filter.saleId) : query.eq("customer_id", filter.customerId)
  const { data, error } = await query
  if (error) throw error
  return data.map((m) => ({
    id: m.id,
    kind: m.kind,
    channel: m.channel,
    status: m.status,
    phone: m.phone,
    body: m.body,
    createdAt: m.created_at,
    authorName: m.author?.full_name ?? null,
  }))
}
