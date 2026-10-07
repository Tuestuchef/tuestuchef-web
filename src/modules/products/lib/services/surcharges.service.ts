import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { ProductSurcharges, SurchargeKind, SurchargeProduct } from "../types/products.types"

// Recargos por talla (p. ej. 3XL) y por color (p. ej. pata de gallo): misma forma, distinta tabla.

// Por cada talla o color, los productos que cobran un extra y cuánto (USD).
export async function listSurcharges(kind: SurchargeKind): Promise<Record<string, Record<string, number>>> {
  const supabase = await createSupabaseServerClient()
  const rows =
    kind === "size"
      ? await supabase.from("size_surcharges").select("target_id:size_id, product_id, amount_usd")
      : await supabase.from("color_surcharges").select("target_id:color_id, product_id, amount_usd")
  if (rows.error) throw rows.error
  const byTarget: Record<string, Record<string, number>> = {}
  for (const row of rows.data) {
    byTarget[row.target_id] ??= {}
    byTarget[row.target_id][row.product_id] = Number(row.amount_usd)
  }
  return byTarget
}

// Productos que pueden llevar recargo: terminados y activos (no combos ni materia prima).
export async function listSurchargeableProducts(): Promise<SurchargeProduct[]> {
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

// Recargos de un producto, por talla y por color, en el orden de cada lista (para su página).
// La página del producto no debe romperse por esto (p. ej. si la migración aún no está aplicada).
export async function listProductSurcharges(productId: string): Promise<ProductSurcharges> {
  const supabase = await createSupabaseServerClient()
  const [sizes, colors] = await Promise.all([
    supabase.from("size_surcharges").select("amount_usd, target:sizes(name, sort_order)").eq("product_id", productId),
    supabase.from("color_surcharges").select("amount_usd, target:colors(name, sort_order)").eq("product_id", productId),
  ])
  const toList = (rows: { amount_usd: number; target: { name: string; sort_order: number } | null }[] | null) =>
    (rows ?? [])
      .sort((a, b) => (a.target?.sort_order ?? 0) - (b.target?.sort_order ?? 0))
      .map((row) => ({ name: row.target?.name ?? "—", amountUsd: Number(row.amount_usd) }))
  return { sizes: sizes.error ? [] : toList(sizes.data), colors: colors.error ? [] : toList(colors.data) }
}

// Guarda los recargos de una talla o un color. null = ese producto deja de llevar recargo.
export async function saveSurcharges(kind: SurchargeKind, targetId: string, surcharges: Record<string, number | null>) {
  const supabase = await createSupabaseServerClient()
  const key = kind === "size" ? "size_id" : "color_id"
  const toSave = Object.entries(surcharges).filter(([, amount]) => amount !== null)
  const toRemove = Object.entries(surcharges)
    .filter(([, amount]) => amount === null)
    .map(([productId]) => productId)

  if (toSave.length) {
    const rows = toSave.map(([product_id, amount_usd]) => ({ product_id, amount_usd: amount_usd!, [key]: targetId }))
    const { error } =
      kind === "size"
        ? await supabase
            .from("size_surcharges")
            .upsert(rows as { product_id: string; amount_usd: number; size_id: string }[], { onConflict: "size_id,product_id" })
        : await supabase
            .from("color_surcharges")
            .upsert(rows as { product_id: string; amount_usd: number; color_id: string }[], { onConflict: "color_id,product_id" })
    if (error) return { error }
  }
  if (toRemove.length) {
    const { error } =
      kind === "size"
        ? await supabase.from("size_surcharges").delete().eq("size_id", targetId).in("product_id", toRemove)
        : await supabase.from("color_surcharges").delete().eq("color_id", targetId).in("product_id", toRemove)
    if (error) return { error }
  }
  return { error: null }
}
