import { describe, expect, it } from "vitest"

import { accountAmountToUsd, paymentUsdt, purchaseLineTotal, usdToAccountAmount } from "./purchase-math.util"

const rates = { bcvUsd: 40, binance: 50, usdUsdt: 1 }

describe("purchase math", () => {
  it("total de línea", () => {
    expect(purchaseLineTotal(2.555, 3)).toBe(7.67)
  })

  it("en Bs convierte con BCV o paralelo; el valor real siempre con Binance", () => {
    expect(usdToAccountAmount(50, "VES", "bcv_usd", rates)).toBe(2000)
    expect(usdToAccountAmount(50, "VES", "parallel", rates)).toBe(2500)
    expect(accountAmountToUsd(2000, "VES", "bcv_usd", rates)).toBe(50)
    expect(paymentUsdt(2000, "VES", rates)).toBe(40)
  })

  it("USD y USDT", () => {
    expect(usdToAccountAmount(10, "USD", "none", rates)).toBe(10)
    expect(usdToAccountAmount(10, "USDT", "none", { ...rates, usdUsdt: 1.02 })).toBe(10.2)
  })
})
