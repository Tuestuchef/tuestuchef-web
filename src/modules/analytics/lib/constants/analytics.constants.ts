import type { CategoryType } from "../types/analytics.types"

export const PERIODS = [
  { value: "mes", label: "Este mes", months: 1 },
  { value: "3m", label: "Últimos 3 meses", months: 3 },
  { value: "6m", label: "Últimos 6 meses", months: 6 },
  { value: "12m", label: "Últimos 12 meses", months: 12 },
  { value: "anio", label: "Este año", months: null },
] as const

export type PeriodValue = (typeof PERIODS)[number]["value"]

export const DEFAULT_PERIOD: PeriodValue = "mes"

// La gráfica de tendencia muestra siempre los últimos 12 meses.
export const TREND_MONTHS = 12

// Mismas reglas que docs/modelo-de-datos.md → Utilidad real.
export const INCOME_TYPES: readonly CategoryType[] = ["sales", "other_income"]
export const DEDUCTION_TYPES: readonly CategoryType[] = [
  "cost",
  "operating_expense",
  "exchange_fee",
  "tax",
  "salary",
  "withdrawal",
]
export const PROFIT_USE_TYPES: readonly CategoryType[] = ["reinvestment", "profit_distribution"]
export const CONTRIBUTION_TYPES: readonly CategoryType[] = ["capital_contribution"]

// Pestañas del dashboard (?vista=).
export const DASHBOARD_VIEWS = [
  { value: "utilidad", label: "Utilidad real" },
  { value: "caja", label: "Flujo de caja" },
  { value: "margen", label: "Margen" },
  { value: "tasa", label: "Efecto de la tasa" },
] as const

export type DashboardView = (typeof DASHBOARD_VIEWS)[number]["value"]

export const DEFAULT_VIEW: DashboardView = "utilidad"
