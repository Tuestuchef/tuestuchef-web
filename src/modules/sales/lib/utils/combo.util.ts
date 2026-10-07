import { round } from "./sale-math.util"

// Recargo de las piezas elegidas de un combo (talla y color), encima del precio del combo.
// Cada pieza trae su cantidad total (para todos los combos de la línea).
export function comboExtraUsd(
  pieces: { variantId: string; quantity: number }[],
  extraOf: (variantId: string) => number | undefined
): number {
  return round(pieces.reduce((sum, p) => sum + p.quantity * (extraOf(p.variantId) ?? 0), 0))
}

// Nombres cortos para elegir entre productos parecidos: sin las palabras que comparten al inicio.
// ["Filipina manga corta botón", "Filipina manga corta cierre"] → ["botón", "cierre"].
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names
  const words = names.map((n) => n.trim().split(/\s+/))
  let common = 0
  while (words.every((w) => w.length > common + 1 && w[common].toLowerCase() === words[0][common].toLowerCase())) common++
  return common === 0 ? names : words.map((w) => w.slice(common).join(" "))
}

// Recargos de un combo para cotizar: por cada talla (o color), lo que suman sus piezas. En cada
// componente cuenta el recargo más alto entre sus productos (si cambia según el modelo), por sus piezas.
// "3XL": filipina +3 y pantalón +2 → combo +5.
export function comboSurcharges<T extends { id: string; amountUsd: number }>(
  components: { quantity: number; productIds: string[] }[],
  surchargesOf: (productId: string) => T[]
): T[] {
  const totals = new Map<string, T>()
  for (const component of components) {
    const highest = new Map<string, T>()
    for (const productId of component.productIds) {
      for (const surcharge of surchargesOf(productId)) {
        const current = highest.get(surcharge.id)
        if (!current || surcharge.amountUsd > current.amountUsd) highest.set(surcharge.id, surcharge)
      }
    }
    for (const [id, surcharge] of highest) {
      totals.set(id, { ...surcharge, amountUsd: round((totals.get(id)?.amountUsd ?? 0) + surcharge.amountUsd * component.quantity) })
    }
  }
  return [...totals.values()]
}
