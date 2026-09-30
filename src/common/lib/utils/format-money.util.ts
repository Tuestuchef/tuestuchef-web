import {
  CURRENCY_SYMBOLS,
  type Currency,
} from "@/common/lib/constants/currency.constants"

const amountFormat = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const rateFormat = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

// "Bs 1.234,56", "$ 12,00", "12,00 USDT". Con signed: "+" o "−" delante.
export function formatMoney(
  amount: number,
  currency: Currency,
  { signed = false }: { signed?: boolean } = {}
) {
  const sign = signed ? (amount > 0 ? "+" : amount < 0 ? "−" : "") : amount < 0 ? "−" : ""
  const value = amountFormat.format(Math.abs(amount))
  const symbol = CURRENCY_SYMBOLS[currency]
  return currency === "USDT" ? `${sign}${value} ${symbol}` : `${sign}${symbol} ${value}`
}

export const formatUsdt = (value: number, options?: { signed?: boolean }) =>
  formatMoney(value, "USDT", options)

export const formatRate = (value: number) => rateFormat.format(value)
