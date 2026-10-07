import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { ComboComponentInput } from "../schemas/products.schema"
import type { ComboComponent, ComboComponentOption } from "../types/products.types"

export async function listComboComponents(comboId: string): Promise<ComboComponent[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("combo_components")
    .select(
      "id, label, quantity, options:combo_component_options(sort_order, product:products!combo_component_options_product_id_fkey(id, name, variants:product_variants(is_active)))"
    )
    .eq("combo_product_id", comboId)
    .order("sort_order")
  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    label: row.label,
    quantity: row.quantity,
    products: [...row.options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((o) =>
        o.product ? [{ id: o.product.id, name: o.product.name, variantCount: o.product.variants.filter((v) => v.is_active).length }] : []
      ),
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

// Crea o edita un componente con sus productos en un paso (la base valida y aplica RLS).
export async function saveComboComponent(input: ComboComponentInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("save_combo_component", {
    p_combo_product_id: input.combo_product_id,
    p_component_id: input.component_id ?? null,
    p_label: input.label ?? null,
    p_quantity: input.quantity,
    p_product_ids: input.product_ids,
  })
}

export async function deleteComboComponent(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("combo_components").delete().eq("id", id).select("id")
}
