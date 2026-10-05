import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toCaracasMonth } from "@/common/lib/utils/format-date.util"

export type PeriodRow = {
  // AAAA-MM
  month: string
  isCurrent: boolean
  isClosed: boolean
  changedAt: string | null
  changedByName: string | null
  reopenReason: string | null
  profitUsdt: number | null
}

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

// Tipos que forman la utilidad real (ingresos menos deducciones).
const PROFIT_TYPES = ["sales", "other_income", "cost", "operating_expense", "exchange_fee", "tax", "salary", "withdrawal"]

// Los últimos 12 meses (el actual primero), con su estado de cierre.
export async function listPeriods(): Promise<PeriodRow[]> {
  const supabase = await createSupabaseServerClient()
  const current = toCaracasMonth()
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(current, -i))
  const { data, error } = await supabase.from("period_status").select("*").gte("period", `${months[months.length - 1]}-01`)
  if (error) throw error

  const authorIds = [...new Set(data.flatMap((r) => (r.changed_by ? [r.changed_by] : [])))]
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] }
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]))
  const byMonth = new Map(data.map((r) => [String(r.period).slice(0, 7), r]))

  return months.map((month) => {
    const row = byMonth.get(month)
    const totals = (row?.totals_snapshot ?? null) as Record<string, number> | null
    return {
      month,
      isCurrent: month === current,
      isClosed: Boolean(row?.is_closed),
      changedAt: row?.changed_at ?? null,
      changedByName: row?.changed_by ? (nameById.get(row.changed_by) ?? null) : null,
      reopenReason: row && !row.is_closed ? row.reason : null,
      profitUsdt: row?.is_closed && totals ? PROFIT_TYPES.reduce((sum, t) => sum + Number(totals[t] ?? 0), 0) : null,
    }
  })
}

export async function closePeriod(month: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("close_period", { p_period: `${month}-01` })
}

export async function reopenPeriod(month: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("reopen_period", { p_period: `${month}-01`, p_reason: reason })
}
