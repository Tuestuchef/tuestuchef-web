import {
  CONTRIBUTION_TYPES,
  DEDUCTION_TYPES,
  INCOME_TYPES,
  PERIODS,
  type PeriodValue,
  PROFIT_USE_TYPES,
} from "../constants/analytics.constants"
import type { AnalyticsData, MonthPoint, PersonFlows, SummaryRow } from "../types/analytics.types"

const round2 = (value: number) => Math.round(value * 100) / 100

// Los N meses (AAAA-MM) que terminan en `lastMonth`, del más antiguo al más reciente.
export function monthsEndingAt(lastMonth: string, count: number): string[] {
  const [year, month] = lastMonth.split("-").map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
  })
}

// Meses que abarca el período elegido (todos terminan en el mes actual).
export function periodMonths(period: PeriodValue, currentMonth: string): string[] {
  const config = PERIODS.find((p) => p.value === period) ?? PERIODS[0]
  if (config.months) return monthsEndingAt(currentMonth, config.months)
  return monthsEndingAt(currentMonth, Number(currentMonth.slice(5, 7)))
}

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("es-VE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(`${month}-15T00:00:00Z`)
  )

// Todas las cifras en USDT. Ingresos y egresos en positivo; la utilidad con su signo.
export function buildAnalytics(rows: SummaryRow[], period: string[], trend: string[]): AnalyticsData {
  const inPeriod = rows.filter((row) => period.includes(row.month))
  const sumOf = (list: SummaryRow[], types: readonly string[]) =>
    list.filter((row) => types.includes(row.category_type)).reduce((sum, row) => sum + row.usdt_value, 0)

  const income = sumOf(inPeriod, INCOME_TYPES)
  const expenses = -sumOf(inPeriod, DEDUCTION_TYPES)
  const profit = income - expenses

  const monthly: MonthPoint[] = trend.map((month) => {
    const monthRows = rows.filter((row) => row.month === month)
    const monthIncome = sumOf(monthRows, INCOME_TYPES)
    const monthExpenses = -sumOf(monthRows, DEDUCTION_TYPES)
    return {
      month,
      label: monthLabel(month),
      income: round2(monthIncome),
      expenses: round2(monthExpenses),
      profit: round2(monthIncome - monthExpenses),
    }
  })

  const outflowTypes = [...DEDUCTION_TYPES, ...PROFIT_USE_TYPES]
  const byCategory = new Map<string, { name: string; type: SummaryRow["category_type"]; amount: number }>()
  for (const row of inPeriod.filter((r) => outflowTypes.includes(r.category_type))) {
    const key = `${row.category_type}:${row.category_name}`
    const current = byCategory.get(key) ?? { name: row.category_name, type: row.category_type, amount: 0 }
    current.amount -= row.usdt_value
    byCategory.set(key, current)
  }

  const people = new Map<string, PersonFlows>()
  for (const row of inPeriod.filter((r) => r.person_name)) {
    const flows = people.get(row.person_name!) ?? {
      person: row.person_name!,
      salaries: 0,
      withdrawals: 0,
      distributions: 0,
      contributions: 0,
    }
    if (row.category_type === "salary") flows.salaries -= row.usdt_value
    if (row.category_type === "withdrawal") flows.withdrawals -= row.usdt_value
    if (row.category_type === "profit_distribution") flows.distributions -= row.usdt_value
    if (row.category_type === "capital_contribution") flows.contributions += row.usdt_value
    people.set(row.person_name!, flows)
  }

  return {
    kpis: {
      income: round2(income),
      expenses: round2(expenses),
      profit: round2(profit),
      profitUses: round2(-sumOf(inPeriod, PROFIT_USE_TYPES)),
      reinvestment: round2(-sumOf(inPeriod, ["reinvestment"])),
      distributions: round2(-sumOf(inPeriod, ["profit_distribution"])),
      contributions: round2(sumOf(inPeriod, CONTRIBUTION_TYPES)),
      margin: income > 0 ? profit / income : null,
    },
    monthly,
    outflowsByCategory: [...byCategory.values()]
      .map((c) => ({ ...c, amount: round2(c.amount) }))
      .filter((c) => c.amount !== 0)
      .sort((a, b) => b.amount - a.amount),
    personFlows: [...people.values()]
      .map((p) => ({
        ...p,
        salaries: round2(p.salaries),
        withdrawals: round2(p.withdrawals),
        distributions: round2(p.distributions),
        contributions: round2(p.contributions),
      }))
      .sort((a, b) => a.person.localeCompare(b.person, "es")),
  }
}
