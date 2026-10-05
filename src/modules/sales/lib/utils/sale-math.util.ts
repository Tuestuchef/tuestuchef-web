import type { Currency } from "@/common/lib/constants/currency.constants"

import { BALANCE_TOLERANCE_USD, type DiscountType, type PaymentRateKind } from "../constants/sales.constants"

// Mismas reglas que create_sale y apply_sale_payment en la base: la base decide,
// esto solo muestra en pantalla lo que se va a guardar.

export const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export const lineTotal = (priceUsd: number, quantity: number) => round(priceUsd * quantity)

export function discountUsd(subtotal: number, type: DiscountType | null, value: number | null): number {
  if (!type || !value || value <= 0) return 0
  return type === "percent" ? round((subtotal * Math.min(value, 100)) / 100) : round(value)
}

export const discountPercent = (subtotal: number, discount: number) => (subtotal > 0 ? (discount / subtotal) * 100 : 0)

// Descuento al mayor: el tramo más alto que alcanzan las piezas (0 si ninguno).
export function volumePercent(tiers: readonly { minQuantity: number; percent: number }[], pieces: number): number {
  return tiers.filter((t) => t.minQuantity <= pieces).reduce((best, t) => (t.minQuantity > best.minQuantity ? t : best), {
    minQuantity: 0,
    percent: 0,
  }).percent
}

export type SaleRates = { bcvUsd: number; bcvEur: number; usdUsdt: number }
export type PaymentMethodRate = { rateKind: PaymentRateKind; currency: Currency }

// Bs (o USDT) por 1 USD de referencia para un método; 1 si cobra en USD.
export function unitsPerUsd(method: PaymentMethodRate, rates: SaleRates): number {
  if (method.rateKind === "bcv_usd") return rates.bcvUsd
  if (method.rateKind === "bcv_eur") return rates.bcvEur
  if (method.currency === "USDT") return rates.usdUsdt
  return 1
}

// Monto a cobrar en la moneda del método para cubrir cierto saldo en USD.
export const usdToMethodAmount = (usd: number, method: PaymentMethodRate, rates: SaleRates) =>
  round(usd * unitsPerUsd(method, rates))

// Lo que cubre un pago del saldo, en USD.
export const methodAmountToUsd = (amount: number, method: PaymentMethodRate, rates: SaleRates) =>
  round(amount / unitsPerUsd(method, rates), 6)

export const isSettled = (balanceUsd: number) => balanceUsd <= BALANCE_TOLERANCE_USD
