import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

// Precio en USD de referencia por método de pago. null = quitar el precio de ese método.
export async function saveProductPrices(productId: string, prices: Record<string, number | null>) {
  const supabase = await createSupabaseServerClient()
  const toSave = Object.entries(prices).filter(([, amount]) => amount !== null)
  const toRemove = Object.entries(prices)
    .filter(([, amount]) => amount === null)
    .map(([methodId]) => methodId)

  if (toSave.length) {
    const { error } = await supabase.from("product_prices").upsert(
      toSave.map(([payment_method_id, amount_usd]) => ({ product_id: productId, payment_method_id, amount_usd: amount_usd! })),
      { onConflict: "product_id,payment_method_id" }
    )
    if (error) return { error }
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("product_prices")
      .delete()
      .eq("product_id", productId)
      .in("payment_method_id", toRemove)
    if (error) return { error }
  }
  return { error: null }
}
