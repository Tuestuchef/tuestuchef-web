import { describe, expect, it } from "vitest"

import {
  discountPercent,
  discountUsd,
  isSettled,
  lineTotal,
  methodAmountToUsd,
  usdToMethodAmount,
} from "./sale-math.util"

const rates = { bcvUsd: 40, bcvEur: 44, usdUsdt: 1.02 }

describe("sale math", () => {
  it("calcula líneas y descuentos como la base", () => {
    expect(lineTotal(19.99, 3)).toBe(59.97)
    expect(discountUsd(40, "percent", 10)).toBe(4)
    expect(discountUsd(40, "percent", 150)).toBe(40)
    expect(discountUsd(40, "amount", 2.555)).toBe(2.56)
    expect(discountUsd(40, null, 5)).toBe(0)
    expect(discountPercent(40, 4)).toBe(10)
  })

  it("convierte USD a la moneda de cada método", () => {
    expect(usdToMethodAmount(25, { rateKind: "bcv_usd", currency: "VES" }, rates)).toBe(1000)
    expect(usdToMethodAmount(25, { rateKind: "bcv_eur", currency: "VES" }, rates)).toBe(1100)
    expect(usdToMethodAmount(25, { rateKind: "none", currency: "USD" }, rates)).toBe(25)
    expect(usdToMethodAmount(25, { rateKind: "none", currency: "USDT" }, rates)).toBe(25.5)
  })

  it("un pago en Bs cubre su equivalente en USD", () => {
    expect(methodAmountToUsd(600, { rateKind: "bcv_usd", currency: "VES" }, rates)).toBe(15)
    expect(isSettled(25 - 24.995)).toBe(true)
    expect(isSettled(0.5)).toBe(false)
  })
})
