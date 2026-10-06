import "server-only"

import type { Currency } from "@/common/lib/constants/currency.constants"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { resolveImageUrl } from "@/modules/products/lib/services/product-images.service"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

import type { CalculatorProduct, PriceCalculatorData } from "../types/sales.types"

// Lo que necesita la calculadora: los mismos precios, métodos, tasa y tramos al mayor que Nueva venta.
export async function getPriceCalculatorData(): Promise<PriceCalculatorData> {
  const supabase = await createSupabaseServerClient()
  const [productsResult, pricesResult, componentsResult, methodsResult, tiersResult, rateStatus] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, kind, category:product_categories(id, name),
         variants:product_variants(is_active, color:colors(name)),
         images:product_images(path, is_primary)`
      )
      .eq("is_active", true)
      .in("kind", ["finished_good", "combo"])
      .order("name"),
    supabase.from("product_prices").select("product_id, payment_method_id, amount_usd"),
    supabase.from("combo_components").select("combo_product_id, quantity"),
    supabase
      .from("payment_methods")
      .select("id, name, rate_kind, account:accounts(currency)")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("volume_discount_tiers").select("min_quantity, percent").eq("scope", "products").order("min_quantity"),
    getRateStatus(),
  ])
  if (productsResult.error) throw productsResult.error
  if (methodsResult.error) throw methodsResult.error

  const prices = new Map<string, Record<string, number>>()
  for (const price of pricesResult.data ?? []) {
    const byMethod = prices.get(price.product_id) ?? {}
    byMethod[price.payment_method_id] = Number(price.amount_usd)
    prices.set(price.product_id, byMethod)
  }
  const comboPieces = new Map<string, number>()
  for (const row of componentsResult.data ?? []) {
    comboPieces.set(row.combo_product_id, (comboPieces.get(row.combo_product_id) ?? 0) + Number(row.quantity))
  }

  const products: CalculatorProduct[] = await Promise.all(
    productsResult.data
      // Un combo sin componentes no se puede vender: tampoco se cotiza.
      .filter((p) => p.kind !== "combo" || comboPieces.has(p.id))
      .map(async (p) => {
        const primary = p.images.find((image) => image.is_primary) ?? p.images[0]
        const colors = [...new Set(p.variants.filter((v) => v.is_active && v.color).map((v) => v.color!.name))]
        return {
          id: p.id,
          name: p.name,
          isCombo: p.kind === "combo",
          categoryId: p.category?.id ?? null,
          categoryName: p.category?.name ?? "Sin categoría",
          colors,
          imageUrl: primary ? await resolveImageUrl(primary.path) : null,
          pricesUsd: prices.get(p.id) ?? {},
          piecesPerUnit: p.kind === "combo" ? (comboPieces.get(p.id) ?? 1) : 1,
        }
      })
  )

  const categories = [...new Map(products.filter((p) => p.categoryId).map((p) => [p.categoryId!, p.categoryName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  const rate = rateStatus.rate
  return {
    products,
    categories,
    methods: methodsResult.data.map((m) => ({
      id: m.id,
      name: m.name,
      currency: (m.account?.currency ?? "USD") as Currency,
      rateKind: m.rate_kind,
    })),
    rates: rate
      ? { bcvUsd: Number(rate.bcv_usd), bcvEur: Number(rate.bcv_eur), usdUsdt: Number(rate.usd_usdt), isCurrent: rateStatus.hasTodayRate }
      : null,
    volumeTiers: (tiersResult.data ?? []).map((t) => ({ minQuantity: t.min_quantity, percent: Number(t.percent) })),
  }
}
