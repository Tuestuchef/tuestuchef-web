import "server-only"

import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import { decideRateSync, type RateSyncDecision } from "../utils/rate-sync.util"
import { fetchDolarApiRates } from "./dolar-api.service"

export type RateSyncResult =
  | { ok: true; decision: RateSyncDecision; rateDate: string }
  | { ok: false; error: string }

// Trae las tasas de DolarAPI y las guarda como tasa automática del día (source = api).
// La guarda el servidor con la clave secreta: no tiene autor. Nunca pisa una corrección manual.
export async function syncExchangeRatesFromApi(): Promise<RateSyncResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, error: "Falta SUPABASE_SECRET_KEY en el servidor." }

  let fetched
  try {
    fetched = await fetchDolarApiRates()
  } catch (error) {
    return { ok: false, error: `No se pudo consultar DolarAPI: ${(error as Error).message}` }
  }

  const { data: existing, error: readError } = await admin
    .from("exchange_rates")
    .select("source, bcv_usd, bcv_eur, binance_usdt, created_at")
    .eq("rate_date", fetched.rateDate)
    .order("created_at", { ascending: false })
  if (readError) return { ok: false, error: readError.message }

  const decision = decideRateSync(existing, fetched, toCaracasDate())
  if (decision === "insert") {
    const { error } = await admin.from("exchange_rates").insert({
      rate_date: fetched.rateDate,
      bcv_usd: fetched.bcvUsd,
      bcv_eur: fetched.bcvEur,
      binance_usdt: fetched.parallelUsd,
      source: "api",
      note: "DolarAPI: BCV oficial (USD, EUR) y paralelo (USDT)",
    })
    if (error) return { ok: false, error: error.message }
  }

  return { ok: true, decision, rateDate: fetched.rateDate }
}
