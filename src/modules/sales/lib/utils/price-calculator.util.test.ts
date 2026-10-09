import { describe, expect, it } from "vitest"

import type { CalculatorProduct, SalePaymentMethod } from "../types/sales.types"
import { type CalculatorLine, calculatorTotals, calculatorWhatsappText, lineLabel, optionalExtras } from "./price-calculator.util"

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
  colorSurcharges: [],
  genders: [],
  genderSizeSurcharges: {},
  ...over,
})

const PRODUCTS = new Map(
  [
    product({ id: "fil", name: "Filipina vinotinto", pricesUsd: { cash: 25, zelle: 25, usdt: 26, pm: 28 } }),
    product({ id: "gor", name: "Gorro de sushi", pricesUsd: { cash: 9, zelle: 9, usdt: 9.5, pm: 10 } }),
    product({ id: "del", name: "Delantal", pricesUsd: { cash: 14, zelle: 14 } }),
    product({ id: "kit", name: "Kit chef", isCombo: true, piecesPerUnit: 3, pricesUsd: { cash: 50, zelle: 50 } }),
    product({
      id: "jog",
      name: "Pantalón jogger",
      pricesUsd: { cash: 27, pm: 27 },
      colorSurcharges: [{ id: "pdg", name: "Pata de gallo", amountUsd: 2 }],
      sizeSurcharges: [
        { id: "3xl", name: "3XL", amountUsd: 3 },
        { id: "6xl", name: "6XL", amountUsd: 5 },
      ],
    }),
    product({
      id: "mc",
      name: "Filipina manga corta broche",
      pricesUsd: { cash: 45, pm: 45 },
      sizeSurcharges: [
        { id: "3xl", name: "3XL", amountUsd: 3 },
        { id: "4xl", name: "4XL", amountUsd: 3 },
      ],
    }),
  ].map((p) => [p.id, p])
)

const RATES = { bcvUsd: 40, bcvEur: 45, usdUsdt: 1 }
let n = 0
const line = (productId: string, quantity: number, extra: Partial<CalculatorLine> = {}): CalculatorLine => ({ id: `l${n++}`, productId, quantity, ...extra })
const totals = (lines: CalculatorLine[], volumeTiers = [] as { minQuantity: number; percent: number }[], rates: typeof RATES | null = RATES) =>
  calculatorTotals({ lines, products: PRODUCTS, methods: METHODS, volumeTiers, rates })

describe("calculadora de precios", () => {
  it("da un total por método, en su moneda, y junta los que dan lo mismo", () => {
    const t = totals([line("fil", 1), line("gor", 2)])
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
    const t = totals([line("kit", 2)], tiers)
    expect(t.pieces).toBe(6)
    expect(t.volumePercent).toBe(5)
    expect(t.nextTier).toEqual({ minQuantity: 12, percent: 10 })
    expect(t.methods[0]).toMatchObject({ names: ["Efectivo", "Zelle"], totalUsd: 95 })
  })

  it("avisa lo que no tiene precio en un método y omite métodos sin ningún precio", () => {
    const t = totals([line("fil", 1), line("del", 1)])
    expect(t.methods.find((m) => m.names.includes("Pago móvil"))).toMatchObject({ totalUsd: 28, missing: ["Delantal"] })
    expect(totals([line("del", 1)]).methods.map((m) => m.names)).toEqual([["Efectivo", "Zelle"]])
  })

  it("sin tasa no inventa los Bs", () => {
    const t = totals([line("fil", 1)], [], null)
    expect(t.methods.find((m) => m.currency === "VES")?.amount).toBeNull()
    expect(t.methods.find((m) => m.currency === "USD")?.amount).toBe(25)
  })

  it("suma el recargo de la talla y el color elegidos en cada línea", () => {
    // 1 jogger pata de gallo 3XL (27 + 2 + 3) + 1 jogger sin opciones (27).
    const t = totals([line("jog", 1, { colorId: "pdg", sizeId: "3xl" }), line("jog", 1)])
    expect(t.methods.find((m) => m.names.includes("Efectivo"))?.totalUsd).toBe(59)
    expect(t.pieces).toBe(2)
    expect(lineLabel(PRODUCTS.get("jog")!, line("jog", 1, { colorId: "pdg", sizeId: "3xl" }))).toBe("Pantalón jogger · pata de gallo · talla 3XL")
  })

  it("los recargos no elegidos quedan como opcionales; los elegidos no", () => {
    expect(optionalExtras([line("jog", 1)], PRODUCTS)).toEqual([
      { productName: "Pantalón jogger", label: "en pata de gallo", minUsd: 2, maxUsd: 2 },
      { productName: "Pantalón jogger", label: "en tallas 3XL–6XL", minUsd: 3, maxUsd: 5 },
    ])
    // Con color y talla elegidos en todas sus líneas, no hay nada que avisar.
    expect(optionalExtras([line("jog", 1, { colorId: "pdg", sizeId: "6xl" })], PRODUCTS)).toEqual([])
    expect(optionalExtras([line("fil", 1)], PRODUCTS)).toEqual([])
  })

  it("arma el texto para WhatsApp con las opciones elegidas y los extras opcionales", () => {
    const lines = [line("jog", 1), line("mc", 1, { sizeId: "3xl" })]
    const text = calculatorWhatsappText(lines, PRODUCTS, totals(lines), { bsPerUsd: 40 })
    expect(text.split("\n")).toEqual([
      "*Tuestuchef - Lista de Precios*",
      "",
      "• 1 × Pantalón jogger",
      "• 1 × Filipina manga corta broche · talla 3XL",
      "",
      "Total:",
      // Solo Bs y un precio en dólares (el del primer método en USD), sin Zelle ni USDT. 27 + 45 + 3 = 75.
      "• USD: $ 75,00",
      "• Pago móvil: Bs 3.000,00",
      "",
      "Opcional:",
      "• Pantalón jogger en pata de gallo: +$ 2,00 (Bs 80,00) c/u",
      "• Pantalón jogger en tallas 3XL–6XL: +$ 3,00 a +$ 5,00 (Bs 120,00 a Bs 200,00) c/u",
    ])
  })

  it("con géneros, la talla cobra según el género y lo no elegido se avisa por género", () => {
    const filipina = product({
      id: "fmc",
      name: "Filipina manga corta",
      pricesUsd: { cash: 45, pm: 45 },
      genders: ["women", "men"],
      genderSizeSurcharges: {
        men: [
          { id: "3xl", name: "3XL", amountUsd: 3 },
          { id: "6xl", name: "6XL", amountUsd: 12 },
        ],
        women: [{ id: "6xl", name: "6XL", amountUsd: 4 }],
      },
    })
    const products = new Map([...PRODUCTS, [filipina.id, filipina]])
    const men3 = line("fmc", 1, { gender: "men", sizeId: "3xl" })
    expect(calculatorTotals({ lines: [men3], products, methods: METHODS, volumeTiers: [], rates: RATES }).methods[0].totalUsd).toBe(48)
    expect(lineLabel(filipina, men3)).toBe("Filipina manga corta · caballero · talla 3XL")
    // Sin género elegido: los extras de cada género.
    expect(optionalExtras([line("fmc", 1)], products)).toEqual([
      { productName: "Filipina manga corta", label: "en talla 6XL (dama)", minUsd: 4, maxUsd: 4 },
      { productName: "Filipina manga corta", label: "en tallas 3XL–6XL (caballero)", minUsd: 3, maxUsd: 12 },
    ])
    // Dama elegida, sin talla: solo lo de dama.
    expect(optionalExtras([line("fmc", 1, { gender: "women" })], products)).toEqual([
      { productName: "Filipina manga corta", label: "en talla 6XL (dama)", minUsd: 4, maxUsd: 4 },
    ])
  })

  it("sin opcionales ni tasa en Bs, el mensaje no lleva esa sección", () => {
    const lines = [line("fil", 1), line("gor", 2)]
    const text = calculatorWhatsappText(lines, PRODUCTS, totals(lines))
    expect(text).not.toContain("Opcional")
    expect(text).toContain("• USD: $ 43,00")
  })
})
