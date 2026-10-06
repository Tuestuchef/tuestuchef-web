import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { SizeSurchargeProduct } from "../types/products.types"

// Recargo por talla: por cada talla, los productos que cobran un extra y cuánto (USD).
export async function listSizeSurcharges(): Promise<Record<string, Record<string, number>>> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("size_surcharges").select("size_id, product_id, amount_usd")
  if (error) throw error
  const bySize: Record<string, Record<string, number>> = {}
  for (const row of data) {
    bySize[row.size_id] ??= {}
    bySize[row.size_id][row.product_id] = Number(row.amount_usd)
  }
  return bySize
}

// Productos que pueden llevar recargo: terminados y activos (no combos ni materia prima).
export async function listSurchargeableProducts(): Promise<SizeSurchargeProduct[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category:product_categories(name, sort_order)")
    .eq("kind", "finished_good")
    .eq("is_active", true)
  if (error) throw error
  return data
    .map((p) => ({ id: p.id, name: p.name, categoryName: p.category?.name ?? "Sin categoría", categorySort: p.category?.sort_order ?? 999 }))
    .sort((a, b) => a.categorySort - b.categorySort || a.categoryName.localeCompare(b.categoryName, "es") || a.name.localeCompare(b.name, "es"))
    .map(({ id, name, categoryName }) => ({ id, name, categoryName }))
}

// Recargos de un producto, en el orden de las tallas (para mostrarlos en su página).
export async function listProductSurcharges(productId: string): Promise<{ sizeName: string; amountUsd: number }[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("size_surcharges")
    .select("amount_usd, size:sizes(name, sort_order)")
    .eq("product_id", productId)
  // La página del producto no debe romperse por esto (p. ej. si la migración aún no está aplicada).
  if (error) return []
  return data
    .sort((a, b) => (a.size?.sort_order ?? 0) - (b.size?.sort_order ?? 0))
    .map((row) => ({ sizeName: row.size?.name ?? "—", amountUsd: Number(row.amount_usd) }))
}

// Guarda los recargos de una talla. null = ese producto deja de llevar recargo.
export async function saveSizeSurcharges(sizeId: string, surcharges: Record<string, number | null>) {
  const supabase = await createSupabaseServerClient()
  const toSave = Object.entries(surcharges).filter(([, amount]) => amount !== null)
  const toRemove = Object.entries(surcharges)
    .filter(([, amount]) => amount === null)
    .map(([productId]) => productId)

  if (toSave.length) {
    const { error } = await supabase.from("size_surcharges").upsert(
      toSave.map(([product_id, amount_usd]) => ({ size_id: sizeId, product_id, amount_usd: amount_usd! })),
      { onConflict: "size_id,product_id" }
    )
    if (error) return { error }
  }
  if (toRemove.length) {
    const { error } = await supabase.from("size_surcharges").delete().eq("size_id", sizeId).in("product_id", toRemove)
    if (error) return { error }
  }
  return { error: null }
}
