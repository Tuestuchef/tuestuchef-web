import type { Enums } from "@/common/lib/db/database.types"

export type Currency = Enums<"currency">

export const CURRENCY_LABELS: Record<Currency, string> = {
  VES: "Bolívares",
  USD: "Dólares",
  USDT: "USDT",
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  VES: "Bs",
  USD: "$",
  USDT: "USDT",
}
