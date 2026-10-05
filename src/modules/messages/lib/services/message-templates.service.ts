import "server-only"

import { cache } from "react"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { MessageKind, MessageTemplate } from "../types/messages.types"

const KIND_ORDER: MessageKind[] = ["sale_note", "payment_reminder", "order_confirmed", "order_ready", "order_cancelled"]

// Una sola lectura por pedido aunque varios botones la pidan (p. ej. Por cobrar).
export const listMessageTemplates = cache(async (): Promise<MessageTemplate[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("message_templates").select("*, editor:profiles!message_templates_updated_by_fkey(full_name)")
  if (error) throw error
  return data
    .map((t) => ({
      kind: t.kind,
      name: t.name,
      body: t.body,
      enabled: t.enabled,
      updatedAt: t.updated_at,
      updatedByName: t.editor?.full_name ?? null,
    }))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
})

export async function getMessageTemplate(kind: MessageKind) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("message_templates").select("kind, body, enabled").eq("kind", kind).maybeSingle()
  return data
}

export async function updateMessageTemplate(kind: MessageKind, values: { name: string; body: string; enabled: boolean }) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("message_templates").update(values).eq("kind", kind).select("kind").single()
}
