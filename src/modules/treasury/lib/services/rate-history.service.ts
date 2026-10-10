import "server-only"

import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import { type HistoricalRates, pickHistoricalRates } from "../utils/rate-history.util"
import { fetchDolarApiHistory } from "./dolar-api.service"

const formatDay = (date: string) => date.split("-").reverse().join("/")

// Tasas de un día pasado según el historial de DolarAPI. null si no hay datos o no responde.
export async function getHistoricalRates(date: string): Promise<HistoricalRates | null> {
  try {
    return pickHistoricalRates(date, await fetchDolarApiHistory())
  } catch {
    return null
  }
}

// Antes de registrar algo con fecha pasada: si ese día no tiene tasa, se guarda la del historial
// (automática, sin autor). Así nadie tiene que inventar la tasa USDT. Hoy no aplica: usa la del día.
export async function ensureRatesForDate(date: string | null | undefined): Promise<void> {
  if (!date || date >= toCaracasDate()) return
  const admin = createSupabaseAdminClient()
  if (!admin) return

  const { data: existing } = await admin.rpc("exchange_rate_for_date", { p_date: date })
  if (existing?.id) return

  const rates = await getHistoricalRates(date)
  if (!rates) return
  await admin.from("exchange_rates").insert({
    rate_date: date,
    bcv_usd: rates.bcvUsd,
    bcv_eur: rates.bcvEur,
    binance_usdt: rates.parallelUsd,
    source: "api",
    note: rates.estimated
      ? `Historial DolarAPI · paralelo estimado desde el ${formatDay(rates.parallelFrom)}`
      : "Historial DolarAPI",
  })
}
