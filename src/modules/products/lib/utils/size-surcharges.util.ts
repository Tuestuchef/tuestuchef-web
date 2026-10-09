import type { ProductGender } from "../constants/products.constants"
import type { SizeSurchargeRow } from "../types/products.types"

// Celda de la tabla "Precio por talla": talla × género (null = todos los géneros).
export const cellKey = (sizeId: string, gender: ProductGender | null) => `${sizeId}|${gender ?? ""}`

// Valor inicial de cada celda: el recargo de ese género o, si no tiene, el de todos los géneros.
export function initialCells(rows: SizeSurchargeRow[], sizeIds: string[], columns: (ProductGender | null)[]): Record<string, number> {
  const cells: Record<string, number> = {}
  for (const sizeId of sizeIds) {
    for (const gender of columns) {
      const own = rows.find((r) => r.sizeId === sizeId && r.gender === gender)
      const all = rows.find((r) => r.sizeId === sizeId && r.gender === null)
      const amount = own?.amountUsd ?? all?.amountUsd
      if (amount !== undefined) cells[cellKey(sizeId, gender)] = amount
    }
  }
  return cells
}

// Atajo "desde 3XL, +$3 por talla": 3XL +3, 4XL +6, 5XL +9… (acumulado) en las tallas desde esa.
export function cumulativeSurcharges(sizeIds: string[], fromSizeId: string, stepUsd: number): Record<string, number> {
  const start = sizeIds.indexOf(fromSizeId)
  if (start < 0 || !(stepUsd > 0)) return {}
  return Object.fromEntries(sizeIds.slice(start).map((id, i) => [id, Math.round(stepUsd * (i + 1) * 100) / 100]))
}
