import type { QuoteCurrencies } from "../types/quotes.types"

export const QUOTE_CURRENCIES_LABELS: Record<QuoteCurrencies, string> = {
  usd: "Solo USD",
  ves: "Solo Bs",
  both: "USD y Bs",
}

export const QUOTE_MESSAGES = {
  SETTINGS_SAVED: "Configuración de presupuestos guardada.",
}
