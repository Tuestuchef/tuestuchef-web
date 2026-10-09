import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { ProductSizeSurchargesInput } from "../schemas/products.schema"
import type { ProductSurcharges, SizeSurchargeRow, SurchargeKind, SurchargeProduct } from "../types/products.types"

// Recargos por talla (p. ej. 3XL) y por color (p. ej. pata de gallo): misma forma, distinta tabla.

// Por cada talla o color, los productos que cobran un extra y cuánto (USD).
export async function listSurcharges(kind: SurchargeKind): Promise<Record<string, Record<string, number>>> {
  const supabase = await createSupabaseServerClient()
  // Por talla: solo los de todos los géneros (los de un género se cargan en la página del producto).
  const rows =
    kind === "size"
      ? await supabase.from("size_surcharges").select("target_id:size_id, product_id, amount_usd").is("gender", null)
      : await supabase.from("color_surcharges").select("target_id:color_id, product_id, amount_usd")
  if (rows.error) throw rows.error
  const byTarget: Record<string, Record<string, number>> = {}
  for (const row of rows.data) {
    byTarget[row.target_id] ??= {}
    byTarget[row.target_id][row.product_id] = Number(row.amount_usd)
  }
  return byTarget
}

// Por talla, los productos con recargo distinto por género (se editan en su página).
export async function listGenderSizeSurcharges(): Promise<Record<string, string[]>> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("size_surcharges").select("size_id, product_id").not("gender", "is", null)
  if (error) return {}
  const bySize: Record<string, string[]> = {}
  for (const row of data) {
    const list = (bySize[row.size_id] ??= [])
    if (!list.includes(row.product_id)) list.push(row.product_id)
  }
  return bySize
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

// Recargos por talla de un producto, por género (la tabla "Precio por talla").
export async function listProductSizeSurcharges(productId: string): Promise<SizeSurchargeRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("size_surcharges").select("size_id, gender, amount_usd").eq("product_id", productId)
  if (error) return []
  return data.map((r) => ({ sizeId: r.size_id, gender: r.gender, amountUsd: Number(r.amount_usd) }))
}

// Reemplaza todos los recargos por talla de un producto en un paso.
export async function saveProductSizeSurcharges(input: ProductSizeSurchargesInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("save_product_size_surcharges", { p_product_id: input.product_id, p_rows: input.rows })
}

// Guarda los recargos de una talla o un color. null = ese producto deja de llevar recargo.
export async function saveSurcharges(kind: SurchargeKind, targetId: string, surcharges: Record<string, number | null>) {
  const supabase = await createSupabaseServerClient()
  const toSave = Object.entries(surcharges).filter(([, amount]) => amount !== null)
  const toRemove = Object.entries(surcharges)
    .filter(([, amount]) => amount === null)
    .map(([productId]) => productId)

  // Por talla: solo el recargo de todos los géneros (reemplaza el que había).
  if (kind === "size") {
    const touched = Object.keys(surcharges)
    if (touched.length) {
      const { error } = await supabase.from("size_surcharges").delete().eq("size_id", targetId).is("gender", null).in("product_id", touched)
      if (error) return { error }
    }
    if (toSave.length) {
      const { error } = await supabase
        .from("size_surcharges")
        .insert(toSave.map(([product_id, amount_usd]) => ({ product_id, amount_usd: amount_usd!, size_id: targetId, gender: null })))
      if (error) return { error }
    }
    return { error: null }
  }

  if (toSave.length) {
    const rows = toSave.map(([product_id, amount_usd]) => ({ product_id, amount_usd: amount_usd!, color_id: targetId }))
    const { error } = await supabase.from("color_surcharges").upsert(rows, { onConflict: "color_id,product_id" })
    if (error) return { error }
  }
  if (toRemove.length) {
    const { error } = await supabase.from("color_surcharges").delete().eq("color_id", targetId).in("product_id", toRemove)
    if (error) return { error }
  }
  return { error: null }
}
