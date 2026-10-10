import "server-only"

import { fetchAll } from "@/common/lib/db/fetch-all.util"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import { GENDERS, type ProductKind } from "../constants/products.constants"
import type { ProductInput } from "../schemas/products.schema"
import type { ProductDetail, ProductListItem, VariantWithStock } from "../types/products.types"
import { listProductImages, resolveImageUrl } from "./product-images.service"
import { assignGenderToUnsetVariants, genderInUse } from "./variants.service"

export async function listProducts(
  filters: { search?: string; categoryId?: string; kind?: ProductKind } = {}
): Promise<ProductListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("products")
    .select(
      `id, kind, name, fulfillment_type, is_active,
       category:product_categories(name),
       variants:product_variants(id, is_active),
       prices:product_prices(amount_usd),
       images:product_images(path, is_primary)`,
    )
    .eq("kind", filters.kind ?? "finished_good")
    .order("is_active", { ascending: false })
    .order("name")
  if (filters.search) query = query.ilike("name", `%${filters.search}%`)
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId)

  const [{ data: products, error }, { data: balances, error: balancesError }] = await Promise.all([
    query,
    fetchAll((from, to) => supabase.from("stock_balances").select("product_id, quantity, is_low").order("variant_id").range(from, to)),
  ])
  if (error) throw error
  if (balancesError) throw balancesError

  return Promise.all(
    products.map(async (product) => {
      const own = balances.filter((b) => b.product_id === product.id)
      const primary = product.images.find((image) => image.is_primary) ?? product.images[0]
      const prices = product.prices.map((p) => Number(p.amount_usd))
      return {
        id: product.id,
        kind: product.kind,
        name: product.name,
        categoryName: product.category?.name ?? "—",
        fulfillmentType: product.fulfillment_type,
        isActive: product.is_active,
        imageUrl: primary ? await resolveImageUrl(primary.path) : null,
        variantCount: product.variants.filter((v) => v.is_active).length,
        totalStock: own.reduce((sum, b) => sum + Number(b.quantity ?? 0), 0),
        lowStockCount: own.filter((b) => b.is_low).length,
        priceFromUsd: prices.length ? Math.min(...prices) : null,
      }
    }),
  )
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data: product } = await supabase
    .from("products")
    .select("*, category:product_categories(name, code)")
    .eq("id", id)
    .maybeSingle()
  if (!product) return null

  const [{ data: variants, error }, { data: balances }, { data: moved }, { data: prices }, images] = await Promise.all([
    supabase
      .from("product_variants")
      .select("*, color:colors(name, sort_order), size:sizes(name, sort_order)")
      .eq("product_id", id),
    supabase.from("stock_balances").select("variant_id, quantity, is_low").eq("product_id", id),
    supabase
      .from("stock_movements")
      .select("variant_id, product_variants!inner(product_id)")
      .eq("product_variants.product_id", id),
    supabase.from("product_prices").select("payment_method_id, amount_usd").eq("product_id", id),
    listProductImages(id),
  ])
  if (error) throw error

  const withMovements = new Set((moved ?? []).map((m) => m.variant_id))
  // Orden: género (Dama, Caballero, Unisex), color (orden, nombre) y luego talla.
  const genderOrder = (g: string | null) => (g ? GENDERS.indexOf(g as (typeof GENDERS)[number]) : -1)
  const sorted = [...variants].sort(
    (a, b) =>
      genderOrder(a.gender) - genderOrder(b.gender) ||
      (a.color?.sort_order ?? -1) - (b.color?.sort_order ?? -1) ||
      (a.color?.name ?? "").localeCompare(b.color?.name ?? "") ||
      (a.size?.sort_order ?? -1) - (b.size?.sort_order ?? -1),
  )
  const rows: VariantWithStock[] = sorted.map((variant) => {
    const balance = balances?.find((b) => b.variant_id === variant.id)
    return {
      id: variant.id,
      sku: variant.sku,
      gender: variant.gender,
      colorId: variant.color_id,
      colorName: variant.color?.name ?? null,
      sizeId: variant.size_id,
      sizeName: variant.size?.name ?? null,
      unitCostUsdt: variant.unit_cost_usdt === null ? null : Number(variant.unit_cost_usdt),
      minStock: Number(variant.min_stock),
      isActive: variant.is_active,
      quantity: Number(balance?.quantity ?? 0),
      isLow: Boolean(balance?.is_low),
      hasMovements: withMovements.has(variant.id),
    }
  })

  return {
    product: {
      ...product,
      categoryName: product.category?.name ?? "—",
      categoryCode: product.category?.code ?? "",
    },
    variants: rows,
    prices: Object.fromEntries((prices ?? []).map((p) => [p.payment_method_id, Number(p.amount_usd)])),
    images,
  }
}

export async function saveProduct(input: ProductInput) {
  const supabase = await createSupabaseServerClient()
  const values = {
    category_id: input.category_id,
    name: input.name,
    description: input.description ?? null,
    fulfillment_type: input.fulfillment_type,
    unit: input.unit,
    genders: input.genders,
    closure: input.closure,
    fit: input.fit,
    model_code: input.model_code,
    labor_cost_usdt: input.labor_cost_usdt,
    is_active: input.is_active,
  }
  if (input.id) {
    // Un género con variantes no se quita (se desactivan sus variantes).
    const inUse = await genderInUse(input.id, input.genders)
    if (inUse) return { data: null, error: { code: "P0001", message: inUse } }
    const result = await supabase.from("products").update(values).eq("id", input.id).select("id").single()
    if (!result.error) await assignGenderToUnsetVariants(input.id)
    return result
  }
  // El tipo (terminado o materia prima) solo se fija al crear.
  return supabase.from("products").insert({ ...values, kind: input.kind }).select("id").single()
}
