import type { Currency } from "@/common/lib/constants/currency.constants"
import { brandConfig } from "@/common/lib/config/brand.config"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { GENDER_LABELS, type ProductGender } from "@/modules/products/lib/constants/products.constants"

import type { CalculatorProduct, CalculatorSurcharge, SalePaymentMethod, VolumeTier } from "../types/sales.types"
import { lineTotal, round, type SaleRates, usdToMethodAmount, volumePercent } from "./sale-math.util"

// Calculadora de precios: las mismas cuentas que Nueva venta (precio por método, descuento al mayor
// por piezas, Bs = USD × tasa del método, recargo de talla y color), sin guardar nada.

// Una línea de la lista. Talla y color son opcionales: solo se eligen si cobran extra (recargo).
// El mismo producto puede ir en varias líneas (p. ej. 2 en M y 1 en 4XL).
export type CalculatorLine = {
  id: string
  productId: string
  quantity: number
  // Género (si el producto ofrece varios): define qué recargos por talla aplican.
  gender?: ProductGender | null
  sizeId?: string | null
  colorId?: string | null
}

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

const findSurcharge = (list: CalculatorSurcharge[], id: string | null | undefined) => (id ? list.find((s) => s.id === id) : undefined)

// Recargos por talla que aplican a un género (sin géneros, los del producto). Con géneros y sin
// género elegido no hay talla que elegir todavía.
export function sizeSurchargesFor(product: CalculatorProduct, gender: ProductGender | null | undefined): CalculatorSurcharge[] {
  if (product.genders.length === 0) return product.sizeSurcharges
  // Con un solo género, ese.
  const effective = gender ?? (product.genders.length === 1 ? product.genders[0] : null)
  return effective ? (product.genderSizeSurcharges[effective] ?? []) : []
}

// Recargo elegido en la línea (talla + color), en USD.
export function lineExtraUsd(product: CalculatorProduct, line: CalculatorLine): number {
  return (
    (findSurcharge(sizeSurchargesFor(product, line.gender), line.sizeId)?.amountUsd ?? 0) +
    (findSurcharge(product.colorSurcharges, line.colorId)?.amountUsd ?? 0)
  )
}

// "Filipina manga corta · caballero · pata de gallo · talla 3XL": el producto con las opciones elegidas.
export function lineLabel(product: CalculatorProduct, line: CalculatorLine): string {
  const color = findSurcharge(product.colorSurcharges, line.colorId)
  const size = findSurcharge(sizeSurchargesFor(product, line.gender), line.sizeId)
  const gender = line.gender && product.genders.length > 1 ? GENDER_LABELS[line.gender].toLowerCase() : null
  return [product.name, gender, color && color.name.toLowerCase(), size && `talla ${size.name}`].filter(Boolean).join(" · ")
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
    return product && line.quantity > 0 ? [{ product, quantity: line.quantity, extra: lineExtraUsd(product, line) }] : []
  })
  const pieces = lines.reduce((sum, l) => sum + l.quantity * l.product.piecesPerUnit, 0)
  const pct = volumePercent(input.volumeTiers, pieces)

  const perMethod = input.methods.flatMap((method): CalculatorMethodTotal[] => {
    const priced = lines.filter((l) => l.product.pricesUsd[method.id] !== undefined)
    // Un método sin precio para nada de la lista no se muestra.
    if (lines.length === 0 || priced.length === 0) return []
    const subtotal = round(priced.reduce((sum, l) => sum + lineTotal(l.product.pricesUsd[method.id] + l.extra, l.quantity), 0))
    const totalUsd = round(subtotal - round((subtotal * pct) / 100))
    const convertsInPlace = method.rateKind === "none" && method.currency !== "USDT"
    return [
      {
        names: [method.name],
        currency: method.currency,
        totalUsd,
        amount: input.rates ? usdToMethodAmount(totalUsd, method, input.rates) : convertsInPlace ? totalUsd : null,
        missing: [...new Set(lines.filter((l) => l.product.pricesUsd[method.id] === undefined).map((l) => l.product.name))],
      },
    ]
  })

  // Juntar los métodos que dan exactamente lo mismo, en el orden de los métodos.
  const grouped: CalculatorMethodTotal[] = []
  for (const total of perMethod) {
    const same = grouped.find(
      (g) => g.currency === total.currency && g.amount === total.amount && g.missing.join("|") === total.missing.join("|")
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

// Recargos que el cliente podría pedir y que no se eligieron en la lista: van como "Opcional" en el
// mensaje. Un producto con alguna línea sin color elegido avisa sus colores con recargo; lo mismo
// con las tallas (resumidas en un rango: "en tallas 3XL–6XL").
export type OptionalExtra = { productName: string; label: string; minUsd: number; maxUsd: number }

export function optionalExtras(lines: CalculatorLine[], products: ReadonlyMap<string, CalculatorProduct>): OptionalExtra[] {
  const productIds = [...new Set(lines.map((l) => l.productId))]
  return productIds.flatMap((productId) => {
    const product = products.get(productId)
    if (!product) return []
    const own = lines.filter((l) => l.productId === productId && l.quantity > 0)
    const extras: OptionalExtra[] = []
    if (product.colorSurcharges.length > 0 && own.some((l) => !findSurcharge(product.colorSurcharges, l.colorId))) {
      for (const color of product.colorSurcharges) {
        extras.push({ productName: product.name, label: `en ${color.name.toLowerCase()}`, minUsd: color.amountUsd, maxUsd: color.amountUsd })
      }
    }
    // Tallas: por cada género abierto (el de la línea o, si no se eligió, todos los del producto).
    const open = own.filter((l) => !findSurcharge(sizeSurchargesFor(product, l.gender), l.sizeId))
    const genders = [...new Set(open.flatMap((l) => (product.genders.length === 0 ? [null] : l.gender ? [l.gender] : product.genders)))]
    for (const gender of genders) {
      const sizes = sizeSurchargesFor(product, gender)
      if (sizes.length === 0) continue
      const amounts = sizes.map((s) => s.amountUsd)
      const of = gender && product.genders.length > 1 ? ` (${GENDER_LABELS[gender].toLowerCase()})` : ""
      const label = sizes.length === 1 ? `en talla ${sizes[0].name}${of}` : `en tallas ${sizes[0].name}–${sizes[sizes.length - 1].name}${of}`
      extras.push({ productName: product.name, label, minUsd: Math.min(...amounts), maxUsd: Math.max(...amounts) })
    }
    return extras
  })
}

// Lo que va en el mensaje al cliente: los Bs (con el nombre de su método, p. ej. "Pago móvil") y un
// solo precio en dólares, el del primer método en USD (efectivo), como "USD". Zelle y USDT no van:
// se cotizan aparte si el cliente los pide.
export type WhatsappPriceRow = { label: string; amount: number; currency: Currency; missing: string[] }

export function whatsappPriceRows(totals: CalculatorTotals): WhatsappPriceRow[] {
  const firstUsd = totals.methods.find((m) => m.currency === "USD")
  return totals.methods.flatMap((m): WhatsappPriceRow[] => {
    if (m.amount === null) return []
    if (m.currency === "VES") return [{ label: m.names.join(" / "), amount: m.amount, currency: m.currency, missing: m.missing }]
    if (m === firstUsd) return [{ label: "USD", amount: m.amount, currency: m.currency, missing: m.missing }]
    return []
  })
}

// "+$ 2,00 (Bs 1.744,78)" o "+$ 3,00 a +$ 5,00 (Bs … a Bs …)". Sin tasa en Bs, solo los dólares.
function extraAmountText(minUsd: number, maxUsd: number, bsPerUsd: number | null): string {
  const usd = minUsd === maxUsd ? `+${formatMoney(minUsd, "USD")}` : `+${formatMoney(minUsd, "USD")} a +${formatMoney(maxUsd, "USD")}`
  if (!bsPerUsd) return usd
  const min = formatMoney(round(minUsd * bsPerUsd), "VES")
  const max = formatMoney(round(maxUsd * bsPerUsd), "VES")
  return `${usd} (${minUsd === maxUsd ? min : `${min} a ${max}`})`
}

// Respuesta lista para pegar en WhatsApp. bsPerUsd: tasa del método en Bs, para el extra en Bs.
export function calculatorWhatsappText(
  lines: CalculatorLine[],
  products: ReadonlyMap<string, CalculatorProduct>,
  totals: CalculatorTotals,
  { bsPerUsd = null }: { bsPerUsd?: number | null } = {}
): string {
  const items = lines.flatMap((line) => {
    const product = products.get(line.productId)
    return product ? [`• ${line.quantity} × ${lineLabel(product, line)}`] : []
  })
  const methods = whatsappPriceRows(totals).map(
    (m) => `• ${m.label}: ${formatMoney(m.amount, m.currency)}${m.missing.length ? ` (sin ${m.missing.join(", ")})` : ""}`
  )
  const optional = optionalExtras(lines, products).map(
    (e) => `• ${e.productName} ${e.label}: ${extraAmountText(e.minUsd, e.maxUsd, bsPerUsd)} c/u`
  )
  return [
    // Entre asteriscos: WhatsApp lo muestra en negrita.
    `*${brandConfig.name} - Lista de Precios*`,
    "",
    ...items,
    "",
    "Total:",
    ...methods,
    ...(totals.volumePercent > 0 ? ["", `Incluye ${totals.volumePercent}% de descuento al mayor.`] : []),
    ...(optional.length ? ["", "Opcional:", ...optional] : []),
  ].join("\n")
}
