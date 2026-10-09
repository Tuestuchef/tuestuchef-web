import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import { GENDER_LABELS, type ProductGender } from "../constants/products.constants"
import type { VariantInput } from "../schemas/products.schema"
import { buildSku, uniqueSku } from "../utils/build-sku.util"

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string }

async function loadSkuContext(productId: string) {
  const supabase = await createSupabaseServerClient()
  const [{ data: product }, { data: colors }, { data: sizes }, { data: skus }] = await Promise.all([
    supabase.from("products").select("genders, closure, fit, model_code, category:product_categories(code)").eq("id", productId).maybeSingle(),
    supabase.from("colors").select("id, code"),
    supabase.from("sizes").select("id, code"),
    supabase.from("product_variants").select("sku"),
  ])
  const colorCode = new Map((colors ?? []).map((c) => [c.id, c.code]))
  const sizeCode = new Map((sizes ?? []).map((s) => [s.id, s.code]))
  return {
    supabase,
    product,
    taken: new Set((skus ?? []).map((s) => s.sku)),
    // SKU de una variante: CAT-MODELO-GÉNERO-CIERRE/CORTE-COLOR-TALLA.
    skuFor: (v: { gender: ProductGender | null; colorId: string | null; sizeId: string | null }) =>
      buildSku({
        categoryCode: product?.category?.code ?? "",
        modelCode: product?.model_code,
        gender: v.gender,
        closure: product?.closure,
        fit: product?.fit,
        colorCode: v.colorId ? colorCode.get(v.colorId) : null,
        sizeCode: v.sizeId ? sizeCode.get(v.sizeId) : null,
      }),
  }
}

export async function saveVariant(input: VariantInput): Promise<Result> {
  const ctx = await loadSkuContext(input.product_id)
  if (!ctx.product) return { ok: false, error: "El producto no existe." }
  // Con géneros, la variante es de uno de ellos (si el producto tiene uno solo, ese).
  const genders = ctx.product.genders
  const gender = genders.length === 0 ? null : (input.gender ?? (genders.length === 1 ? genders[0] : null))
  if (genders.length > 0 && !gender) return { ok: false, error: "Elige el género de la variante." }

  const values = {
    gender,
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

  const sku = input.sku ?? uniqueSku(ctx.skuFor({ gender, colorId: values.color_id, sizeId: values.size_id }), ctx.taken)
  const { error } = await ctx.supabase.from("product_variants").insert({ ...values, product_id: input.product_id, sku })
  if (error) return { ok: false, error: error.message, code: error.code }
  return { ok: true, data: undefined }
}

// Crea todas las combinaciones género × color × talla que aún no existan, con SKU automático.
// Sin géneros marcados se usan todos los del producto.
export async function createVariantCombinations(
  productId: string,
  genderIds: ProductGender[],
  colorIds: string[],
  sizeIds: string[]
): Promise<Result<number>> {
  const ctx = await loadSkuContext(productId)
  if (!ctx.product) return { ok: false, error: "El producto no existe." }

  const { data: existing } = await ctx.supabase.from("product_variants").select("gender, color_id, size_id").eq("product_id", productId)
  const key = (g: string | null, c: string | null, s: string | null) => `${g ?? ""}|${c ?? ""}|${s ?? ""}`
  const exists = new Set((existing ?? []).map((v) => key(v.gender, v.color_id, v.size_id)))

  const offered = ctx.product.genders
  const genders: (ProductGender | null)[] = offered.length ? (genderIds.length ? genderIds.filter((g) => offered.includes(g)) : offered) : [null]
  const colors = colorIds.length ? colorIds : [null]
  const sizes = sizeIds.length ? sizeIds : [null]
  const rows = []
  for (const gender of genders) {
    for (const colorId of colors) {
      for (const sizeId of sizes) {
        if (exists.has(key(gender, colorId, sizeId))) continue
        const sku = uniqueSku(ctx.skuFor({ gender, colorId, sizeId }), ctx.taken)
        ctx.taken.add(sku)
        rows.push({ product_id: productId, gender, color_id: colorId, size_id: sizeId, sku })
      }
    }
  }
  if (!rows.length) return { ok: true, data: 0 }

  const { error } = await ctx.supabase.from("product_variants").insert(rows)
  if (error) return { ok: false, error: error.message, code: error.code }
  return { ok: true, data: rows.length }
}

// Antes de guardar los géneros de un producto: no se quita un género que tiene variantes.
export async function genderInUse(productId: string, genders: ProductGender[]): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("product_variants").select("gender").eq("product_id", productId).not("gender", "is", null)
  const removed = [...new Set((data ?? []).map((v) => v.gender!))].filter((g) => !genders.includes(g))
  if (!removed.length) return null
  return `Hay variantes de ${removed.map((g) => GENDER_LABELS[g]).join(" y ")}: desactívalas en vez de quitar el género.`
}

// Al darle géneros a un producto que no tenía: sus variantes sin género (y sin movimientos) pasan al
// primero, con su SKU. Las de los demás géneros se crean con "Crear variantes".
export async function assignGenderToUnsetVariants(productId: string): Promise<void> {
  const ctx = await loadSkuContext(productId)
  const first = ctx.product?.genders[0]
  if (!first) return
  const { data: unset } = await ctx.supabase
    .from("product_variants")
    .select("id, sku, color_id, size_id, moved:stock_movements(id)")
    .eq("product_id", productId)
    .is("gender", null)
  for (const variant of unset ?? []) {
    if (variant.moved.length) continue
    const sku = uniqueSku(ctx.skuFor({ gender: first, colorId: variant.color_id, sizeId: variant.size_id }), ctx.taken)
    ctx.taken.add(sku)
    await ctx.supabase.from("product_variants").update({ gender: first, sku }).eq("id", variant.id)
  }
}
