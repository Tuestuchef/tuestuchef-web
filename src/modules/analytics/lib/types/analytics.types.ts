import type { Enums } from "@/common/lib/db/database.types"

export type CategoryType = Enums<"category_type">

// Una fila de analytics_ledger_summary (USDT con signo).
export type SummaryRow = {
  month: string
  category_type: CategoryType
  category_name: string
  person_name: string | null
  usdt_value: number
}

export type AnalyticsKpis = {
  income: number
  expenses: number
  // Utilidad real = ingresos − costos − gastos − comisiones − impuestos − sueldos y retiros.
  profit: number
  // Salen de la utilidad: reinversión y reparto.
  profitUses: number
  contributions: number
  // profit / income; null sin ingresos.
  margin: number | null
}

export type MonthPoint = {
  month: string
  label: string
  income: number
  expenses: number
  profit: number
}

export type CategoryAmount = {
  name: string
  type: CategoryType
  amount: number
}

export type PersonFlows = {
  person: string
  salaries: number
  withdrawals: number
  distributions: number
  contributions: number
}

export type AnalyticsData = {
  kpis: AnalyticsKpis
  monthly: MonthPoint[]
  outflowsByCategory: CategoryAmount[]
  personFlows: PersonFlows[]
}
