import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { ExchangeRateInput } from "../schemas/exchange-rate.schema"
import type { ExchangeRate, RateStatus } from "../types/treasury.types"
import { isRateCurrent } from "../utils/rate-status.util"
import { ensureRatesForDate } from "./rate-history.service"

export async function getRateStatus(): Promise<RateStatus> {
  const supabase = await createSupabaseServerClient()
  const [{ data: rate }, { data: today }] = await Promise.all([
    supabase.from("current_exchange_rate").select("*").maybeSingle(),
    supabase.rpc("caracas_today"),
  ])

  const current = rate?.id ? (rate as ExchangeRate) : null
  const todayDate = today ?? ""

  return {
    rate: current,
    today: todayDate,
    hasTodayRate: isRateCurrent(current, todayDate),
  }
}

export async function listRecentRates(limit = 10) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*, author:profiles!exchange_rates_created_by_fkey(full_name)")
    .order("rate_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

// Hoy por defecto; owner y admin también cargan fechas pasadas. Corregir = registrar otra (RLS).
export async function createExchangeRate(input: ExchangeRateInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("exchange_rates").insert({
    bcv_usd: input.bcv_usd,
    bcv_eur: input.bcv_eur,
    binance_usdt: input.binance_usdt,
    usd_usdt: input.usd_usdt ?? 1,
    note: input.note ?? null,
    ...(input.rate_date ? { rate_date: input.rate_date } : {}),
  })
}

// Tasas vigentes en una fecha (la de esa fecha o la registrada ese día). Si es pasada y no hay,
// se trae del historial de DolarAPI. null si tampoco hay ahí.
export async function getRatesForDate(date: string): Promise<ExchangeRate | null> {
  await ensureRatesForDate(date)
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("exchange_rate_for_date", { p_date: date })
  if (error) throw error
  return data?.id ? data : null
}
