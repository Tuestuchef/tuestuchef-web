import { describe, expect, it } from "vitest"

import { formatSalary, salaryInUsd } from "./salary.util"

const rates = { bcvUsd: 40, bcvEur: 44, usdUsdt: 1 }

describe("sueldos", () => {
  it("a tasa BCV se muestra en su moneda de acuerdo", () => {
    expect(formatSalary({ amount: 400, currency: "VES", rateKind: "bcv_usd" })).toBe("$ 400,00 a tasa BCV")
    expect(formatSalary({ amount: 300, currency: "VES", rateKind: "bcv_eur" })).toBe("€ 300,00 a tasa BCV")
  })

  it("en USD de referencia: euros a tasa BCV usan el euro BCV del día", () => {
    expect(salaryInUsd({ amount: 400, currency: "VES", rateKind: "bcv_usd" }, rates)).toBe(400)
    // 300 € × 44 Bs = 13.200 Bs = 330 USD a 40.
    expect(salaryInUsd({ amount: 300, currency: "VES", rateKind: "bcv_eur" }, rates)).toBe(330)
    expect(salaryInUsd({ amount: 8000, currency: "VES", rateKind: "none" }, rates)).toBe(200)
  })
})
