import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { VariantInput } from "../schemas/products.schema"
import { buildSku, uniqueSku } from "../utils/build-sku.util"

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string }

async function loadSkuContext(productId: string) {
  const supabase = await createSupabaseServerClient()
  const [{ data: product }, { data: colors }, { data: sizes }, { data: skus }] = await Promise.all([
    supabase.from("products").select("gender, closure, fit, model_code, category:product_categories(code)").eq("id", productId).maybeSingle(),
    supabase.from("colors").select("id, code"),
    supabase.from("sizes").select("id, code"),
    supabase.from("product_variants").select("sku"),
  ])
  return {
    supabase,
    product,
    colorCode: new Map((colors ?? []).map((c) => [c.id, c.code])),
    sizeCode: new Map((sizes ?? []).map((s) => [s.id, s.code])),
    taken: new Set((skus ?? []).map((s) => s.sku)),
  }
}

export async function saveVariant(input: VariantInput): Promise<Result> {
  const ctx = await loadSkuContext(input.product_id)
  if (!ctx.product) return { ok: false, error: "El producto no existe." }

  const generated = buildSku({
    categoryCode: ctx.product.category?.code ?? "",
    modelCode: ctx.product.model_code,
    gender: ctx.product.gender,
    closure: ctx.product.closure,
    fit: ctx.product.fit,
    colorCode: input.color_id ? ctx.colorCode.get(input.color_id) : null,
    sizeCode: input.size_id ? ctx.sizeCode.get(input.size_id) : null,
  })

  const values = {
    color_id: input.color_id ?? null,
    size_id: input.size_id ?? null,
    min_stock: input.min_stock,
    is_active: input.is_active,
  }

  if (input.id) {
    const { data, error } = await ctx.supabase
      .from("product_variants")
      .update({ ...values, ...(input.sku ? { sku: input.sku } : {}) })
      .eq("id", input.id)
      .select("id")
    if (error) return { ok: false, error: error.message, code: error.code }
    if (!data.length) return { ok: false, error: "No tienes permiso para editar esta variante." }
    return { ok: true, data: undefined }
  }

  const sku = input.sku ?? uniqueSku(generated, ctx.taken)
  const { error } = await ctx.supabase.from("product_variants").insert({ ...values, product_id: input.product_id, sku })
  if (error) return { ok: false, error: error.message, code: error.code }
  return { ok: true, data: undefined }
}

// Crea todas las combinaciones color × talla que aún no existan, con SKU automático.
export async function createVariantCombinations(
  productId: string,
  colorIds: string[],
  sizeIds: string[]
): Promise<Result<number>> {
  const ctx = await loadSkuContext(productId)
  if (!ctx.product) return { ok: false, error: "El producto no existe." }

  const { data: existing } = await ctx.supabase.from("product_variants").select("color_id, size_id").eq("product_id", productId)
  const exists = new Set((existing ?? []).map((v) => `${v.color_id ?? ""}|${v.size_id ?? ""}`))

  const colors = colorIds.length ? colorIds : [null]
  const sizes = sizeIds.length ? sizeIds : [null]
  const rows = []
  for (const colorId of colors) {
    for (const sizeId of sizes) {
      if (exists.has(`${colorId ?? ""}|${sizeId ?? ""}`)) continue
      const sku = uniqueSku(
        buildSku({
          categoryCode: ctx.product.category?.code ?? "",
    modelCode: ctx.product.model_code,
          gender: ctx.product.gender,
          closure: ctx.product.closure,
          fit: ctx.product.fit,
          colorCode: colorId ? ctx.colorCode.get(colorId) : null,
          sizeCode: sizeId ? ctx.sizeCode.get(sizeId) : null,
        }),
        ctx.taken
      )
      ctx.taken.add(sku)
      rows.push({ product_id: productId, color_id: colorId, size_id: sizeId, sku })
    }
  }
  if (!rows.length) return { ok: true, data: 0 }

  const { error } = await ctx.supabase.from("product_variants").insert(rows)
  if (error) return { ok: false, error: error.message, code: error.code }
  return { ok: true, data: rows.length }
}
