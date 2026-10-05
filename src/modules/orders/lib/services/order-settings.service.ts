import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { CustomizationTypeInput, VolumeTierInput } from "../schemas/orders.schema"
import type { CustomizationType, VolumeTier } from "../types/orders.types"

const toNumber = (value: number | null) => (value === null ? null : Number(value))

export async function listCustomizationTypes(): Promise<CustomizationType[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("customization_types").select("*").order("sort_order").order("name")
  if (error) throw error
  return data.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    unitPriceUsd: toNumber(t.unit_price_usd),
    minQuantity: t.min_quantity,
    maxSizeCm: toNumber(t.max_size_cm),
    defaultSizeCm: toNumber(t.default_size_cm),
    requiresText: t.requires_text,
    requiresLogo: t.requires_logo,
    isActive: t.is_active,
  }))
}

export async function updateCustomizationType(input: CustomizationTypeInput) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("customization_types")
    .update({
      name: input.name,
      description: input.description ?? null,
      unit_price_usd: input.unit_price_usd ?? null,
      min_quantity: input.min_quantity,
      max_size_cm: input.max_size_cm ?? null,
      default_size_cm: input.default_size_cm ?? null,
      is_active: input.is_active,
    })
    .eq("id", input.id)
    .select("id")
    .single()
}

export async function listVolumeTiers(): Promise<VolumeTier[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("volume_discount_tiers").select("id, scope, min_quantity, percent").order("min_quantity")
  if (error) throw error
  return data.map((t) => ({ id: t.id, scope: t.scope, minQuantity: t.min_quantity, percent: Number(t.percent) }))
}

export async function addVolumeTier(input: VolumeTierInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("volume_discount_tiers").insert(input).select("id").single()
}

export async function deleteVolumeTier(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("volume_discount_tiers").delete().eq("id", id).select("id")
}
