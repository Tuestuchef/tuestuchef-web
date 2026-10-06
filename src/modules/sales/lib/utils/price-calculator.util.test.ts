import { describe, expect, it } from "vitest"

import type { CalculatorProduct, SalePaymentMethod } from "../types/sales.types"
import { calculatorTotals, calculatorWhatsappText, sizeSurchargeSummary } from "./price-calculator.util"

const METHODS: SalePaymentMethod[] = [
  { id: "cash", name: "Efectivo", currency: "USD", rateKind: "none" },
  { id: "zelle", name: "Zelle", currency: "USD", rateKind: "none" },
  { id: "usdt", name: "USDT", currency: "USDT", rateKind: "none" },
  { id: "pm", name: "Pago móvil", currency: "VES", rateKind: "bcv_usd" },
]

const product = (over: Partial<CalculatorProduct>): CalculatorProduct => ({
  id: "x",
  name: "Producto",
  isCombo: false,
  categoryId: null,
  categoryName: "—",
  colors: [],
  imageUrl: null,
  pricesUsd: {},
  piecesPerUnit: 1,
  sizeSurcharges: [],
  ...over,
})

const PRODUCTS = new Map(
  [
    product({ id: "fil", name: "Filipina vinotinto", pricesUsd: { cash: 25, zelle: 25, usdt: 26, pm: 28 } }),
    product({ id: "gor", name: "Gorro de sushi", pricesUsd: { cash: 9, zelle: 9, usdt: 9.5, pm: 10 } }),
    product({ id: "del", name: "Delantal", pricesUsd: { cash: 14, zelle: 14 } }),
    product({ id: "kit", name: "Kit chef", isCombo: true, piecesPerUnit: 3, pricesUsd: { cash: 50, zelle: 50 } }),
  ].map((p) => [p.id, p])
)

const RATES = { bcvUsd: 40, bcvEur: 45, usdUsdt: 1 }
const totals = (lines: { productId: string; quantity: number }[], volumeTiers = [] as { minQuantity: number; percent: number }[], rates: typeof RATES | null = RATES) =>
  calculatorTotals({ lines, products: PRODUCTS, methods: METHODS, volumeTiers, rates })

describe("calculadora de precios", () => {
  it("da un total por método, en su moneda, y junta los que dan lo mismo", () => {
    const t = totals([
      { productId: "fil", quantity: 1 },
      { productId: "gor", quantity: 2 },
    ])
    expect(t.pieces).toBe(3)
    expect(t.methods).toEqual([
      { names: ["Efectivo", "Zelle"], currency: "USD", totalUsd: 43, amount: 43, missing: [] },
      { names: ["USDT"], currency: "USDT", totalUsd: 45, amount: 45, missing: [] },
      // Bs: el precio de su propia lista (28 + 2 × 10) × BCV.
      { names: ["Pago móvil"], currency: "VES", totalUsd: 48, amount: 1920, missing: [] },
    ])
  })

  it("aplica el descuento al mayor por piezas (un combo cuenta sus componentes)", () => {
    const tiers = [
      { minQuantity: 6, percent: 5 },
      { minQuantity: 12, percent: 10 },
    ]
    const t = totals([{ productId: "kit", quantity: 2 }], tiers)
    expect(t.pieces).toBe(6)
    expect(t.volumePercent).toBe(5)
    expect(t.nextTier).toEqual({ minQuantity: 12, percent: 10 })
    expect(t.methods[0]).toMatchObject({ names: ["Efectivo", "Zelle"], totalUsd: 95 })
  })

  it("avisa lo que no tiene precio en un método y omite métodos sin ningún precio", () => {
    const t = totals([
      { productId: "fil", quantity: 1 },
      { productId: "del", quantity: 1 },
    ])
    expect(t.methods.find((m) => m.names.includes("Pago móvil"))).toMatchObject({ totalUsd: 28, missing: ["Delantal"] })
    const onlyDelantal = totals([{ productId: "del", quantity: 1 }])
    expect(onlyDelantal.methods.map((m) => m.names)).toEqual([["Efectivo", "Zelle"]])
  })

  it("sin tasa no inventa los Bs", () => {
    const t = totals([{ productId: "fil", quantity: 1 }], [], null)
    expect(t.methods.find((m) => m.currency === "VES")?.amount).toBeNull()
    expect(t.methods.find((m) => m.currency === "USD")?.amount).toBe(25)
  })

  it("arma el texto para WhatsApp", () => {
    const lines = [
      { productId: "fil", quantity: 1 },
      { productId: "gor", quantity: 2 },
    ]
    const text = calculatorWhatsappText(lines, PRODUCTS, totals(lines))
    expect(text.split("\n")).toEqual([
      "*Tuestuchef - Lista de Precios*",
      "",
      "• 1 × Filipina vinotinto",
      "• 2 × Gorro de sushi",
      "",
      "Total:",
      // Solo Bs y un precio en dólares (el del primer método en USD), sin Zelle ni USDT.
      "• USD: $ 43,00",
      "• Pago móvil: Bs 1.920,00",
    ])
  })

  it("resume el recargo por talla en una línea", () => {
    expect(sizeSurchargeSummary([])).toBeNull()
    expect(sizeSurchargeSummary([{ sizeName: "3XL", amountUsd: 3 }])).toBe("3XL: +$ 3,00")
    expect(
      sizeSurchargeSummary([
        { sizeName: "3XL", amountUsd: 3 },
        { sizeName: "6XL", amountUsd: 3 },
      ])
    ).toBe("3XL–6XL: +$ 3,00")
    expect(
      sizeSurchargeSummary([
        { sizeName: "3XL", amountUsd: 3 },
        { sizeName: "4XL", amountUsd: 4 },
        { sizeName: "6XL", amountUsd: 6 },
      ])
    ).toBe("3XL–6XL: +$ 3,00 a +$ 6,00")
  })
})
