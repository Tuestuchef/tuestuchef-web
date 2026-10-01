import type { Currency } from "@/common/lib/constants/currency.constants"

import type { SupplierRateKind } from "../constants/purchases.constants"
import type { PurchaseRates } from "../types/purchases.types"

// Mismas reglas que apply_purchase_payment en la base: la base decide; esto solo
// muestra en pantalla lo que se va a guardar.

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export const purchaseLineTotal = (unitCostUsd: number, quantity: number) => round(unitCostUsd * quantity)

// Moneda de la cuenta por 1 USD de referencia.
export function unitsPerUsd(currency: Currency, rateKind: SupplierRateKind, rates: PurchaseRates): number {
  if (currency === "VES") return rateKind === "parallel" ? rates.binance * rates.usdUsdt : rates.bcvUsd
  if (currency === "USDT") return rates.usdUsdt
  return 1
}

export const usdToAccountAmount = (usd: number, currency: Currency, rateKind: SupplierRateKind, rates: PurchaseRates) =>
  round(usd * unitsPerUsd(currency, rateKind, rates))

export const accountAmountToUsd = (amount: number, currency: Currency, rateKind: SupplierRateKind, rates: PurchaseRates) =>
  round(amount / unitsPerUsd(currency, rateKind, rates), 6)

// Valor real (USDT) de un pago: siempre con Binance.
export function paymentUsdt(amount: number, currency: Currency, rates: PurchaseRates): number {
  if (currency === "VES") return round(amount / rates.binance, 6)
  if (currency === "USD") return round(amount * rates.usdUsdt, 6)
  return amount
}
