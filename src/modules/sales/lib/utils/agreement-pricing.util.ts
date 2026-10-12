import type { CustomerAgreement } from "@/modules/customers/lib/types/agreements.types"

import type { CalculatorProduct, SellableVariant } from "../types/sales.types"

const round2 = (value: number) => Math.round(value * 100) / 100

// Los productos que se le pueden vender a un cliente, con los precios de su acuerdo (igual que
// variant_price_usd en la base): precio fijo en cualquier método, o % sobre el precio del método,
// o el % general; el recargo de talla o color va encima. Sin cliente: se quitan los exclusivos.
export function variantsForCustomer(
  variants: SellableVariant[],
  customerId: string | null,
  agreement: CustomerAgreement | null,
  // Todos los métodos de pago: el precio fijo vale en cualquiera, aunque el producto no tenga precio ahí.
  methodIds: string[]
): SellableVariant[] {
  return priceForAgreement(visibleForCustomer(variants, customerId), agreement, methodIds)
}

// Sin los exclusivos de otros clientes (o de todos, si no hay cliente).
export const visibleForCustomer = (variants: SellableVariant[], customerId: string | null) =>
  variants.filter((v) => isAllowedFor(v, customerId))

export const isAllowedFor = (variant: SellableVariant, customerId: string | null) =>
  !variant.exclusiveCustomerId || variant.exclusiveCustomerId === customerId

// Los precios del acuerdo (sin filtrar).
export function priceForAgreement(variants: SellableVariant[], agreement: CustomerAgreement | null, methodIds: string[]): SellableVariant[] {
  if (!agreement) return variants
  const rules = new Map(agreement.rules.map((r) => [r.productId, r]))
  return variants.map((v) => {
    const rule = rules.get(v.productId)
    const percent = rule?.discountPercent ?? (rule ? null : agreement.generalDiscountPercent)
    if (rule?.fixedPriceUsd == null && percent == null) return v
    const methods = rule?.fixedPriceUsd != null ? methodIds : Object.keys(v.pricesUsd)
    const pricesUsd: Record<string, number> = {}
    for (const method of methods) {
      const base = v.pricesUsd[method] - v.extraUsd
      pricesUsd[method] = rule?.fixedPriceUsd != null ? round2(rule.fixedPriceUsd + v.extraUsd) : round2(round2(base * (1 - percent! / 100)) + v.extraUsd)
    }
    return { ...v, pricesUsd, agreementPrice: true }
  })
}

// Calculadora: los productos que ve un cliente y sus precios del acuerdo (sin los recargos, que van aparte).
export function calculatorProductsFor(
  products: CalculatorProduct[],
  customerId: string | null,
  agreement: CustomerAgreement | null,
  methodIds: string[]
): CalculatorProduct[] {
  const visible = products.filter((p) => !p.exclusiveCustomerId || p.exclusiveCustomerId === customerId)
  if (!agreement) return visible
  const rules = new Map(agreement.rules.map((r) => [r.productId, r]))
  return visible.map((p) => {
    const rule = rules.get(p.id)
    const percent = rule?.discountPercent ?? (rule ? null : agreement.generalDiscountPercent)
    if (rule?.fixedPriceUsd == null && percent == null) return p
    const pricesUsd: Record<string, number> = {}
    for (const method of rule?.fixedPriceUsd != null ? methodIds : Object.keys(p.pricesUsd)) {
      pricesUsd[method] = rule?.fixedPriceUsd != null ? rule.fixedPriceUsd : round2(p.pricesUsd[method] * (1 - percent! / 100))
    }
    return { ...p, pricesUsd }
  })
}
