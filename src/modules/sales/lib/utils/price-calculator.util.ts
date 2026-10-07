import type { Currency } from "@/common/lib/constants/currency.constants"
import { brandConfig } from "@/common/lib/config/brand.config"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import type {
  CalculatorProduct,
  SalePaymentMethod,
  VolumeTier,
} from "../types/sales.types"
import {
  lineTotal,
  round,
  type SaleRates,
  usdToMethodAmount,
  volumePercent,
} from "./sale-math.util"

// Calculadora de precios: las mismas cuentas que Nueva venta (precio por método, descuento al mayor
// por piezas, Bs = USD × tasa del método), sin guardar nada.

export type CalculatorLine = { productId: string; quantity: number }

export type CalculatorMethodTotal = {
  // Métodos que dan el mismo total en la misma moneda van juntos ("Efectivo / Zelle").
  names: string[]
  currency: Currency
  totalUsd: number
  // En la moneda del método; null si cobra en Bs y no hay tasa.
  amount: number | null
  // Productos de la lista sin precio para este método (no entran en su total).
  missing: string[]
}

export type CalculatorTotals = {
  pieces: number
  volumePercent: number
  // Siguiente tramo al mayor, para avisar cuánto falta.
  nextTier: VolumeTier | null
  methods: CalculatorMethodTotal[]
}

export function calculatorTotals(input: {
  lines: CalculatorLine[]
  products: ReadonlyMap<string, CalculatorProduct>
  methods: SalePaymentMethod[]
  volumeTiers: VolumeTier[]
  rates: SaleRates | null
}): CalculatorTotals {
  const lines = input.lines.flatMap((line) => {
    const product = input.products.get(line.productId)
    return product && line.quantity > 0
      ? [{ product, quantity: line.quantity }]
      : []
  })
  const pieces = lines.reduce(
    (sum, l) => sum + l.quantity * l.product.piecesPerUnit,
    0,
  )
  const pct = volumePercent(input.volumeTiers, pieces)

  const perMethod = input.methods.flatMap((method): CalculatorMethodTotal[] => {
    const priced = lines.filter(
      (l) => l.product.pricesUsd[method.id] !== undefined,
    )
    // Un método sin precio para nada de la lista no se muestra.
    if (lines.length === 0 || priced.length === 0) return []
    const subtotal = round(
      priced.reduce(
        (sum, l) => sum + lineTotal(l.product.pricesUsd[method.id], l.quantity),
        0,
      ),
    )
    const totalUsd = round(subtotal - round((subtotal * pct) / 100))
    const convertsInPlace =
      method.rateKind === "none" && method.currency !== "USDT"
    return [
      {
        names: [method.name],
        currency: method.currency,
        totalUsd,
        amount: input.rates
          ? usdToMethodAmount(totalUsd, method, input.rates)
          : convertsInPlace
            ? totalUsd
            : null,
        missing: lines
          .filter((l) => l.product.pricesUsd[method.id] === undefined)
          .map((l) => l.product.name),
      },
    ]
  })

  // Juntar los métodos que dan exactamente lo mismo, en el orden de los métodos.
  const grouped: CalculatorMethodTotal[] = []
  for (const total of perMethod) {
    const same = grouped.find(
      (g) =>
        g.currency === total.currency &&
        g.amount === total.amount &&
        g.missing.join("|") === total.missing.join("|"),
    )
    if (same) same.names.push(...total.names)
    else grouped.push(total)
  }

  return {
    pieces,
    volumePercent: pct,
    nextTier: input.volumeTiers.find((t) => t.minQuantity > pieces) ?? null,
    methods: grouped,
  }
}

// Lo que va en el mensaje al cliente: los Bs (con el nombre de su método, p. ej. "Pago móvil") y un
// solo precio en dólares, el del primer método en USD (efectivo), como "USD". Zelle y USDT no van:
// se cotizan aparte si el cliente los pide.
export type WhatsappPriceRow = {
  label: string
  amount: number
  currency: Currency
  missing: string[]
}

export function whatsappPriceRows(
  totals: CalculatorTotals,
): WhatsappPriceRow[] {
  const firstUsd = totals.methods.find((m) => m.currency === "USD")
  return totals.methods.flatMap((m): WhatsappPriceRow[] => {
    if (m.amount === null) return []
    if (m.currency === "VES")
      return [
        {
          label: m.names.join(" / "),
          amount: m.amount,
          currency: m.currency,
          missing: m.missing,
        },
      ]
    if (m === firstUsd)
      return [
        {
          label: "USD",
          amount: m.amount,
          currency: m.currency,
          missing: m.missing,
        },
      ]
    return []
  })
}

// Respuesta lista para pegar en WhatsApp.
export function calculatorWhatsappText(
  lines: CalculatorLine[],
  products: ReadonlyMap<string, CalculatorProduct>,
  totals: CalculatorTotals,
): string {
  const items = lines.flatMap((line) => {
    const product = products.get(line.productId)
    return product ? [`• ${line.quantity} × ${product.name}`] : []
  })
  const methods = whatsappPriceRows(totals).map(
    (m) =>
      `• ${m.label}: ${formatMoney(m.amount, m.currency)}${m.missing.length ? ` (sin ${m.missing.join(", ")})` : ""}`,
  )
  return [
    // Entre asteriscos: WhatsApp lo muestra en negrita.
    `*${brandConfig.name} - Lista de Precios*`,
    "",
    ...items,
    "",
    "Total:",
    ...methods,
    ...(totals.volumePercent > 0
      ? ["", `Incluye ${totals.volumePercent}% de descuento al mayor.`]
      : []),
  ].join("\n")
}

// "3XL–6XL: +$ 3,00" (mismo recargo) o "3XL–6XL: +$ 3,00 a +$ 5,00"; "3XL: +$ 3,00" si es una sola talla.
export function sizeSurchargeSummary(surcharges: CalculatorProduct["sizeSurcharges"]): string | null {
  if (surcharges.length === 0) return null
  const first = surcharges[0].name
  const last = surcharges[surcharges.length - 1].name
  const amounts = surcharges.map((s) => s.amountUsd)
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const sizes = surcharges.length === 1 ? first : `${first}–${last}`
  const range = min === max ? `+${formatMoney(min, "USD")}` : `+${formatMoney(min, "USD")} a +${formatMoney(max, "USD")}`
  return `${sizes}: ${range}`
}

// "Pata de gallo +$ 2,00" (o varios, separados por " · "). Los colores no son un rango como las tallas.
export function colorSurchargeSummary(surcharges: CalculatorProduct["colorSurcharges"]): string | null {
  if (surcharges.length === 0) return null
  return surcharges.map((s) => `${s.name} +${formatMoney(s.amountUsd, "USD")}`).join(" · ")
}
