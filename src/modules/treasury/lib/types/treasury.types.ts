import type { Currency } from "@/common/lib/constants/currency.constants"
import type { Tables } from "@/common/lib/db/database.types"

import type { AccountKind } from "../constants/treasury.constants"

export type Account = Tables<"accounts">
export type ExchangeRate = Tables<"exchange_rates">

export type RateStatus = {
  rate: ExchangeRate | null
  today: string
  hasTodayRate: boolean
}

export type AccountBalance = {
  accountId: string
  name: string
  currency: Currency
  kind: AccountKind
  isActive: boolean
  balance: number
  entriesCount: number
  lastMovementAt: string | null
}

export type PaymentMethod = Tables<"payment_methods"> & {
  account: { name: string; currency: Currency } | null
}

export type TransferSummary = {
  id: string
  occurredAt: string
  from: { name: string; currency: Currency }
  to: { name: string; currency: Currency }
  amountOut: number
  amountIn: number
  // Negativo = comisión (pérdida); positivo = ganancia cambiaria. En moneda de origen.
  feeAmount: number
  note: string | null
  isVoided: boolean
}

// Tasas leídas de DolarAPI (Bs por unidad). parallelUsd se guarda como tasa USDT.
export type ApiRates = {
  rateDate: string
  bcvUsd: number
  bcvEur: number
  parallelUsd: number
}
