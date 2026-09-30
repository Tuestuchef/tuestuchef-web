import { z } from "zod"

import {
  optionalPositiveAmountSchema,
  optionalTextSchema,
  pastOrTodayDateSchema,
  positiveAmountSchema,
} from "@/common/lib/schemas/form-fields.schema"

export const exchangeRateSchema = z.object({
  bcv_usd: positiveAmountSchema("la tasa BCV dólar", 8),
  bcv_eur: positiveAmountSchema("la tasa BCV euro", 8),
  binance_usdt: positiveAmountSchema("la tasa Binance", 8),
  // Opcional: por defecto 1 (1 USD = 1 USDT).
  usd_usdt: optionalPositiveAmountSchema("USD → USDT", 8),
  note: optionalTextSchema(200),
  // Vacío = hoy. Fechas pasadas: solo owner y admin.
  rate_date: pastOrTodayDateSchema,
})

export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>
export type ExchangeRateField = keyof ExchangeRateInput
