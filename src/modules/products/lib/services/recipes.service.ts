import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { RecipeLineInput } from "../schemas/products.schema"
import type { MaterialOption, ProductMarginRow, RecipeLine } from "../types/products.types"

const variantLabel = (v: { color: { name: string } | null; size: { name: string } | null }) =>
  [v.color?.name, v.size?.name].filter(Boolean).join(" · ") || "Única"

export async function listRecipe(productId: string): Promise<RecipeLine[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("product_recipe_lines")
    .select(
      `id, quantity, size_id, raw_variant_id, raw_product_id,
       size:sizes(name, sort_order),
       raw_variant:product_variants(sku, color:colors(name), size:sizes(name), product:products(name, unit)),
       raw_product:products!product_recipe_lines_raw_product_id_fkey(name, unit)`,
    )
    .eq("product_id", productId)
  if (error) throw error

  // Por material y luego por talla (la cantidad por defecto primero).
  const sorted = [...data].sort(
    (x, y) =>
      (x.raw_variant_id ?? x.raw_product_id ?? "").localeCompare(y.raw_variant_id ?? y.raw_product_id ?? "") ||
      (x.size?.sort_order ?? -1) - (y.size?.sort_order ?? -1),
  )
  return sorted.map((line) => {
    const specific = line.raw_variant
    return {
      id: line.id,
      materialKey: line.raw_variant_id ?? line.raw_product_id ?? "",
      materialLabel: specific
        ? `${specific.product?.name ?? "—"} · ${variantLabel(specific)}`
        : `${line.raw_product?.name ?? "—"} · mismo color que la prenda`,
      unit: (specific?.product?.unit ?? line.raw_product?.unit ?? "unit") as RecipeLine["unit"],
      sizeName: line.size?.name ?? null,
      quantity: Number(line.quantity),
    }
  })
}

// Materiales para la receta: cada material "del mismo color que la prenda" y cada variante específica.
export async function listMaterialOptions(): Promise<MaterialOption[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name, unit, variants:product_variants(id, sku, is_active, color:colors(name), size:sizes(name))")
    .eq("kind", "raw_material")
    .eq("is_active", true)
    .order("name")
  if (error) throw error

  return data.flatMap((product) => {
    const variants = product.variants.filter((v) => v.is_active)
    const byColor = variants.some((v) => v.color)
    return [
      ...(byColor
        ? [{ value: `product:${product.id}`, label: `${product.name} · mismo color que la prenda`, unit: product.unit }]
        : []),
      ...variants.map((v) => ({
        value: `variant:${v.id}`,
        label: `${product.name} · ${variantLabel(v)}`,
        unit: product.unit,
      })),
    ]
  })
}

export async function addRecipeLine(input: RecipeLineInput) {
  const supabase = await createSupabaseServerClient()
  const [kind, id] = input.material.split(":")
  return supabase.from("product_recipe_lines").insert({
    product_id: input.product_id,
    raw_variant_id: kind === "variant" ? id : null,
    raw_product_id: kind === "product" ? id : null,
    size_id: input.size_id ?? null,
    quantity: input.quantity,
  })
}

export async function deleteRecipeLine(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("product_recipe_lines").delete().eq("id", id).select("id")
}

// Margen por variante y método (la función devuelve 0 filas a staff).
export async function listProductMargins(productId: string): Promise<ProductMarginRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("product_margins").eq("product_id", productId)
  if (error) throw error
  return data.map((row) => ({
    variantId: row.variant_id,
    sku: row.sku,
    methodName: row.method_name,
    priceUsd: Number(row.price_usd),
    priceUsdt: Number(row.price_usdt),
    materialCostUsdt: row.material_cost_usdt === null ? null : Number(row.material_cost_usdt),
    laborCostUsdt: Number(row.labor_cost_usdt),
    marginUsdt: row.margin_usdt === null ? null : Number(row.margin_usdt),
    marginPercent: row.margin_percent === null ? null : Number(row.margin_percent),
    costSource: row.cost_source as ProductMarginRow["costSource"],
    costMinUsdt: row.cost_min_usdt === null ? null : Number(row.cost_min_usdt),
    costMaxUsdt: row.cost_max_usdt === null ? null : Number(row.cost_max_usdt),
  }))
}
