import { describe, expect, it } from "vitest"

import { customizationTotal, quoteTotals } from "./quote-math.util"

const tiers = [{ minQuantity: 10, percent: 5 }]

describe("quoteTotals", () => {
  it("coincide con la base: al mayor por piezas e IVA sobre la base", () => {
    // Mismo caso que la prueba de la base: 10 × 25, 5% al mayor, IVA 16% → 275,50.
    const totals = quoteTotals({
      lines: [{ quantity: 10, discountPercent: 0, price: 25, pieces: 10 }],
      customization: 0,
      volumeTiers: tiers,
      discountType: null,
      discountValue: null,
      vatPercent: 16,
    })
    expect(totals).toMatchObject({ subtotal: 250, volumeDiscount: 12.5, vat: 38, total: 275.5, volumePercent: 5 })
  })

  it("descuento por línea y por presupuesto", () => {
    const totals = quoteTotals({
      lines: [{ quantity: 2, discountPercent: 10, price: 25, pieces: 2 }],
      customization: 8,
      volumeTiers: tiers,
      discountType: "amount",
      discountValue: 3,
      vatPercent: null,
    })
    // 50 − 10% = 45; + 8 = 53; − 3 = 50.
    expect(totals).toMatchObject({ lineDiscounts: 5, subtotal: 53, discount: 3, total: 50 })
  })
})

describe("customizationTotal", () => {
  it("aplica el descuento al mayor por la cantidad de cada tipo", () => {
    const price = () => 4
    expect(customizationTotal([{ typeId: "a", quantity: 6 }, { typeId: "a", quantity: 6 }], price, tiers)).toBe(45.6)
    expect(customizationTotal([{ typeId: "a", quantity: 2 }], price, tiers)).toBe(8)
  })
})
