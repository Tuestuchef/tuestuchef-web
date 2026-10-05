import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { BusinessRuleInput } from "../schemas/orders.schema"
import type { BusinessRule } from "../types/orders.types"

export async function listBusinessRules(): Promise<BusinessRule[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("business_rules").select("*").order("sort_order").order("created_at")
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    enforcedBySystem: r.enforced_by_system,
    isActive: r.is_active,
    sortOrder: r.sort_order,
    updatedAt: r.updated_at,
  }))
}

export async function saveBusinessRule(input: BusinessRuleInput) {
  const supabase = await createSupabaseServerClient()
  const values = {
    title: input.title,
    body: input.body,
    enforced_by_system: input.enforced_by_system,
    is_active: input.is_active,
    sort_order: input.sort_order,
  }
  if (input.id) return supabase.from("business_rules").update(values).eq("id", input.id).select("id").single()
  return supabase.from("business_rules").insert(values).select("id").single()
}
