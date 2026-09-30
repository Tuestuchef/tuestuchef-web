import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import type { ApiRates } from "../types/treasury.types"

export type ExistingRateRow = {
  source: "api" | "manual"
  bcv_usd: number
  bcv_eur: number
  binance_usdt: number
  created_at: string
}

export type RateSyncDecision = "insert" | "skip_manual" | "skip_same"

// Tasas ya guardadas para esa fecha BCV, de la más reciente a la más antigua.
// - Si alguien la corrigió a mano hoy, la automática no la pisa.
// - Si la última automática ya tiene esos valores y se guardó hoy, no se duplica.
//   Si es de otro día se guarda igual: cada día queda con su tasa (y el aviso
//   "falta la tasa de hoy" no aparece cuando el BCV no publicó).
export function decideRateSync(existing: ExistingRateRow[], fetched: ApiRates, today: string): RateSyncDecision {
  const savedToday = (row: ExistingRateRow) => toCaracasDate(row.created_at) === today
  if (existing.some((row) => row.source === "manual" && savedToday(row))) return "skip_manual"

  const lastApi = existing.find((row) => row.source === "api")
  if (
    lastApi &&
    savedToday(lastApi) &&
    Number(lastApi.bcv_usd) === fetched.bcvUsd &&
    Number(lastApi.bcv_eur) === fetched.bcvEur &&
    Number(lastApi.binance_usdt) === fetched.parallelUsd
  ) {
    return "skip_same"
  }

  return "insert"
}
