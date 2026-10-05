import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { ComboComponentInput } from "../schemas/products.schema"
import type { ComboComponent, ComboComponentOption } from "../types/products.types"

export async function listComboComponents(comboId: string): Promise<ComboComponent[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("combo_components")
    .select("id, quantity, component_product_id, product:products!combo_components_component_product_id_fkey(name, variants:product_variants(is_active))")
    .eq("combo_product_id", comboId)
    .order("sort_order")
  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    productId: row.component_product_id,
    productName: row.product?.name ?? "—",
    quantity: row.quantity,
    variantCount: (row.product?.variants ?? []).filter((v) => v.is_active).length,
  }))
}

// Productos que pueden ir en un combo: terminados y activos.
export async function listComboComponentOptions(): Promise<ComboComponentOption[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name")
    .eq("kind", "finished_good")
    .eq("is_active", true)
    .order("name")
  if (error) throw error
  return data
}

export async function addComboComponent(input: ComboComponentInput) {
  const supabase = await createSupabaseServerClient()
  const { count } = await supabase
    .from("combo_components")
    .select("id", { count: "exact", head: true })
    .eq("combo_product_id", input.combo_product_id)
  return supabase
    .from("combo_components")
    .insert({ ...input, sort_order: (count ?? 0) + 1 })
    .select("id")
    .single()
}

export async function deleteComboComponent(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("combo_components").delete().eq("id", id).select("id")
}
