import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toCaracasMonth } from "@/common/lib/utils/format-date.util"

import { type PeriodValue, TREND_MONTHS } from "../constants/analytics.constants"
import type { AnalyticsData } from "../types/analytics.types"
import { buildAnalytics, monthsEndingAt, periodMonths } from "../utils/build-analytics.util"

const lastDayOf = (month: string) => {
  const [year, m] = month.split("-").map(Number)
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10)
}

// Una sola consulta: los últimos 12 meses (cubre cualquier período) agregados en la base.
export async function getAnalytics(period: PeriodValue): Promise<AnalyticsData & { periodMonths: string[] }> {
  const currentMonth = toCaracasMonth()
  const trend = monthsEndingAt(currentMonth, TREND_MONTHS)
  const months = periodMonths(period, currentMonth)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("analytics_ledger_summary", {
    p_from: `${trend[0]}-01`,
    p_to: lastDayOf(currentMonth),
  })
  if (error) throw error

  const rows = data.map((row) => ({ ...row, usdt_value: Number(row.usdt_value) }))
  return { ...buildAnalytics(rows, months, trend), periodMonths: months }
}
