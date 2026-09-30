import type { ApiRates } from "../types/treasury.types"

export type ExistingRateRow = {
  source: "api" | "manual"
  bcv_usd: number
  bcv_eur: number
  binance_usdt: number
}

export type RateSyncDecision = "insert" | "skip_manual" | "skip_same"

// Tasas ya guardadas para ese día, de la más reciente a la más antigua.
// - Si alguien la corrigió a mano, la automática no la pisa.
// - Si la última automática ya tiene esos valores, no se duplica.
export function decideRateSync(existing: ExistingRateRow[], fetched: ApiRates): RateSyncDecision {
  if (existing.some((row) => row.source === "manual")) return "skip_manual"

  const lastApi = existing.find((row) => row.source === "api")
  if (
    lastApi &&
    Number(lastApi.bcv_usd) === fetched.bcvUsd &&
    Number(lastApi.bcv_eur) === fetched.bcvEur &&
    Number(lastApi.binance_usdt) === fetched.parallelUsd
  ) {
    return "skip_same"
  }

  return "insert"
}
