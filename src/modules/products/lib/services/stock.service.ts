import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { caracasNoonIso, toCaracasDate } from "@/common/lib/utils/format-date.util"

import type { StockMovementInput } from "../schemas/products.schema"
import type {
  InitialStockPreviewRow,
  StockMovementItem,
  StockVariantOption,
} from "../types/products.types"
import type { StockCsvRow } from "../utils/parse-stock-csv.util"
import { variantLabel } from "../utils/variant-label.util"

export async function createStockMovement(input: StockMovementInput) {
  const supabase = await createSupabaseServerClient()
  const isBackdated = input.date && input.date !== toCaracasDate()

  // Producción: consume la receta y suma las prendas (todo en la base, en una transacción).
  if (input.movement_type === "production") {
    return supabase.rpc("register_production", {
      p_variant_id: input.variant_id,
      p_quantity: input.quantity,
      p_unit_cost_usdt: input.unit_cost_usdt,
      p_note: input.note,
      p_occurred_at: isBackdated ? caracasNoonIso(input.date!) : undefined,
    })
  }

  const sign = input.movement_type === "adjustment" && input.direction === "out" ? -1 : 1
  return supabase.from("stock_movements").insert({
    variant_id: input.variant_id,
    movement_type: input.movement_type,
    quantity: sign * input.quantity,
    unit_cost_usdt: input.unit_cost_usdt ?? null,
    note: input.note ?? null,
    ...(isBackdated ? { occurred_at: caracasNoonIso(input.date!) } : {}),
  })
}

// Variantes activas de productos con stock (no solo por encargo), para el buscador.
export async function listStockVariantOptions(): Promise<StockVariantOption[]> {
  const supabase = await createSupabaseServerClient()
  const [{ data: variants, error }, { data: balances }, { data: recipes }] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "id, sku, product_id, gender, color:colors(name), size:sizes(name), product:products!inner(name, kind, is_active, fulfillment_type)"
      )
      .eq("is_active", true)
      .eq("product.is_active", true)
      .neq("product.fulfillment_type", "made_to_order")
      .order("sku"),
    supabase.from("stock_balances").select("variant_id, quantity"),
    supabase.from("product_recipe_lines").select("product_id"),
  ])
  if (error) throw error
  const quantity = new Map((balances ?? []).map((b) => [b.variant_id, Number(b.quantity ?? 0)]))
  const withRecipe = new Set((recipes ?? []).map((r) => r.product_id))
  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    label: `${v.product.name} — ${variantLabel(v)}`,
    quantity: quantity.get(v.id) ?? 0,
    isRawMaterial: v.product.kind === "raw_material",
    hasRecipe: withRecipe.has(v.product_id),
  }))
}

export async function listStockMovements(filters: { productId?: string; limit?: number } = {}): Promise<StockMovementItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("stock_movements")
    .select(
      `id, occurred_at, movement_type, quantity, unit_cost_usdt, note,
       variant:product_variants!inner(sku, product_id, product:products(name)),
       author:profiles!stock_movements_created_by_fkey(full_name)`
    )
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 30)
  if (filters.productId) query = query.eq("variant.product_id", filters.productId)

  const { data, error } = await query
  if (error) throw error
  return data.map((m) => ({
    id: m.id,
    occurredAt: m.occurred_at,
    movementType: m.movement_type,
    quantity: Number(m.quantity),
    unitCostUsdt: m.unit_cost_usdt === null ? null : Number(m.unit_cost_usdt),
    note: m.note,
    sku: m.variant.sku,
    productName: m.variant.product?.name ?? "—",
    authorName: m.author?.full_name ?? null,
  }))
}

// Vista previa de la carga inicial: cada fila con su producto o el motivo por el que no se puede cargar.
export async function previewInitialStock(rows: StockCsvRow[]): Promise<InitialStockPreviewRow[]> {
  if (!rows.length) return []
  const supabase = await createSupabaseServerClient()
  const skus = rows.map((r) => r.sku)
  const [{ data: variants }, { data: moved }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, sku, is_active, gender, color:colors(name), size:sizes(name), product:products(name, is_active, fulfillment_type)")
      .in("sku", skus),
    supabase.from("stock_movements").select("variant_id, product_variants!inner(sku)").in("product_variants.sku", skus),
  ])
  const bySku = new Map((variants ?? []).map((v) => [v.sku, v]))
  const withMovements = new Set((moved ?? []).map((m) => m.variant_id))

  return rows.map((row) => {
    const variant = bySku.get(row.sku)
    let error: string | null = null
    if (!variant) error = "El SKU no existe."
    else if (!variant.is_active || !variant.product?.is_active) error = "Producto o variante inactivos."
    else if (variant.product?.fulfillment_type === "made_to_order") error = "Producto solo por encargo: no lleva stock."
    else if (withMovements.has(variant.id)) error = "Ya tiene movimientos: usa un ajuste."
    return {
      line: row.line,
      sku: row.sku,
      quantity: row.quantity,
      unitCostUsdt: row.unitCostUsdt,
      productName: variant?.product?.name ?? null,
      variantLabel: variant ? variantLabel(variant) : null,
      error,
    }
  })
}

export async function loadInitialStock(rows: StockCsvRow[]) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("load_initial_stock", {
    p_rows: rows.map((r) => ({ sku: r.sku, quantity: r.quantity, unit_cost_usdt: r.unitCostUsdt ?? "" })),
  })
}
