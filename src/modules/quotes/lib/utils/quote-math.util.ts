import { round, volumePercent } from "@/modules/sales/lib/utils/sale-math.util"

import type { DiscountType, QuoteTotals } from "../types/quotes.types"

// Mismas reglas que quote_apply / quote_totals en la base: la base decide, esto solo muestra.

export type QuoteMathLine = {
  quantity: number
  discountPercent: number
  // Precio unitario de la lista (undefined = sin precio en esa lista).
  price: number | undefined
  pieces: number
}

export type QuoteMathCustomization = { typeId: string; quantity: number }

type Tier = { minQuantity: number; percent: number }

// Total de personalización: por tipo, con su descuento al mayor por la cantidad del tipo.
export function customizationTotal(
  customizations: QuoteMathCustomization[],
  unitPrice: (typeId: string) => number,
  tiers: readonly Tier[]
): number {
  const perType = new Map<string, number>()
  for (const c of customizations) perType.set(c.typeId, (perType.get(c.typeId) ?? 0) + c.quantity)
  return round(
    [...perType].reduce((sum, [typeId, qty]) => sum + round(qty * unitPrice(typeId) * (1 - volumePercent(tiers, qty) / 100)), 0)
  )
}

// Totales de una lista: productos (con descuento por línea) + personalización; al mayor sobre
// productos; descuento manual sobre lo que queda; IVA al final.
export function quoteTotals(input: {
  lines: QuoteMathLine[]
  customization: number
  volumeTiers: readonly Tier[]
  discountType: DiscountType | null
  discountValue: number | null
  vatPercent: number | null
}): QuoteTotals & { volumePercent: number; pieces: number } {
  let gross = 0
  let net = 0
  for (const line of input.lines) {
    const price = line.price ?? 0
    gross += round(price * line.quantity)
    net += round(price * line.quantity * (1 - line.discountPercent / 100))
  }
  const pieces = input.lines.reduce((sum, l) => sum + l.pieces, 0)
  const percent = volumePercent(input.volumeTiers, pieces)
  const products = round(net)
  const subtotal = round(products + input.customization)
  const volumeDiscount = round((products * percent) / 100)
  const base = round(subtotal - volumeDiscount)
  const discount =
    input.discountType && input.discountValue && input.discountValue > 0
      ? Math.min(base, input.discountType === "percent" ? round((base * Math.min(input.discountValue, 100)) / 100) : round(input.discountValue))
      : 0
  const vat = input.vatPercent ? round(((base - discount) * input.vatPercent) / 100) : 0
  return {
    subtotal,
    volumeDiscount,
    lineDiscounts: round(gross - net),
    discount,
    vat,
    total: round(base - discount + vat),
    volumePercent: percent,
    pieces,
  }
}
