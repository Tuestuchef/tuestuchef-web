import { describe, expect, it } from "vitest"

import type { SummaryRow } from "@/modules/analytics/lib/types/analytics.types"
import {
  buildAnalytics,
  monthsEndingAt,
  periodMonths,
} from "@/modules/analytics/lib/utils/build-analytics.util"

const row = (month: string, category_type: SummaryRow["category_type"], usdt_value: number, extra: Partial<SummaryRow> = {}) =>
  ({ month, category_type, category_name: category_type, person_name: null, usdt_value, ...extra }) as SummaryRow

describe("períodos", () => {
  it("meses que cruzan el año", () => {
    expect(monthsEndingAt("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
  })
  it("este año = enero hasta el mes actual", () => {
    expect(periodMonths("anio", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"])
    expect(periodMonths("mes", "2026-09")).toEqual(["2026-09"])
  })
})

describe("utilidad real", () => {
  const rows: SummaryRow[] = [
    row("2026-09", "sales", 1000),
    row("2026-09", "other_income", 50),
    row("2026-09", "cost", -300),
    row("2026-09", "operating_expense", -100),
    row("2026-09", "exchange_fee", -10),
    row("2026-09", "tax", -40),
    row("2026-09", "salary", -200, { person_name: "Ana" }),
    row("2026-09", "withdrawal", -50, { person_name: "Ana" }),
    row("2026-09", "reinvestment", -150),
    row("2026-09", "profit_distribution", -100, { person_name: "Ana" }),
    row("2026-09", "capital_contribution", 500, { person_name: "Ana" }),
    row("2026-08", "sales", 400),
    row("2026-08", "cost", -500),
  ]

  const data = buildAnalytics(rows, ["2026-09"], ["2026-08", "2026-09"])

  it("ingresos − costos − gastos − comisiones − impuestos − sueldos y retiros", () => {
    expect(data.kpis.income).toBe(1050)
    expect(data.kpis.expenses).toBe(700)
    expect(data.kpis.profit).toBe(350)
    expect(data.kpis.margin).toBeCloseTo(350 / 1050)
  })

  it("reinversión y reparto salen de la utilidad, no se restan antes; el aporte no es ingreso", () => {
    expect(data.kpis.profitUses).toBe(250)
    expect(data.kpis.contributions).toBe(500)
  })

  it("tendencia mensual con meses en rojo", () => {
    expect(data.monthly.map((m) => [m.month, m.profit])).toEqual([
      ["2026-08", -100],
      ["2026-09", 350],
    ])
  })

  it("a dónde va el dinero, de mayor a menor", () => {
    expect(data.outflowsByCategory[0]).toMatchObject({ type: "cost", amount: 300 })
    expect(data.outflowsByCategory.map((c) => c.type)).toContain("reinvestment")
  })

  it("el Pulpo: flujos por persona", () => {
    expect(data.personFlows).toEqual([
      { person: "Ana", salaries: 200, withdrawals: 50, distributions: 100, contributions: 500 },
    ])
  })

  it("sin ingresos no hay margen", () => {
    expect(buildAnalytics([row("2026-09", "cost", -10)], ["2026-09"], ["2026-09"]).kpis.margin).toBeNull()
  })
})
