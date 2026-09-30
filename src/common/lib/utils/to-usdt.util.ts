import type { Currency } from "@/common/lib/constants/currency.constants"

export type RateSnapshot = {
  binanceRate: number
  usdUsdtRate: number
}

// Misma fórmula que public.to_usdt en la base. Solo para vistas previas:
// el valor que se guarda lo calcula siempre la base.
export function toUsdt(amount: number, currency: Currency, rates: RateSnapshot) {
  switch (currency) {
    case "USDT":
      return amount
    case "USD":
      return amount * rates.usdUsdtRate
    case "VES":
      return amount / rates.binanceRate
  }
}

export function fromUsdt(value: number, currency: Currency, rates: RateSnapshot) {
  switch (currency) {
    case "USDT":
      return value
    case "USD":
      return value / rates.usdUsdtRate
    case "VES":
      return value * rates.binanceRate
  }
}
