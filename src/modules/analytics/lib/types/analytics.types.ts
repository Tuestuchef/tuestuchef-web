import type { Currency } from "@/common/lib/constants/currency.constants"
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
  // Desglose de los usos: reinversión (gastada) y reparto.
  reinvestment: number
  distributions: number
  contributions: number
  // IVA de los cobros de ventas con IVA: aparte, no es ingreso ni resta de la utilidad.
  vatCollected: number
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

export type DashboardRange = { from: string; to: string }

export type CashFlowRow = {
  accountId: string
  name: string
  currency: Currency
  isActive: boolean
  opening: number
  inflows: number
  outflows: number
  closing: number
  inflowsUsdt: number
  outflowsUsdt: number
}

export type ProductSalesMargin = {
  productId: string
  productName: string
  units: number
  revenueUsd: number
  revenueUsdt: number
  materialCostUsdt: number
  laborCostUsdt: number
  marginUsdt: number
  linesWithoutCost: number
}

export type RateEffectRow = {
  source: "sale" | "purchase"
  methodName: string
  paymentsCount: number
  nominalUsdt: number
  realUsdt: number
  differenceUsdt: number
}

export type ProfitPolicy = {
  reserveAccountId: string | null
  reservePercent: number
  reinvestmentPercent: number
}

export type ReserveActivity = {
  accountName: string
  transferredUsdt: number
  balanceUsdt: number
}
