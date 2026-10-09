import type { QuoteItem } from "../types/quotes.types"

export type QuoteDisplayRow =
  | { kind: "line"; item: QuoteItem }
  // Mismo producto, color, precio y descuento en varias tallas: una fila con el desglose.
  | {
      kind: "group"
      key: string
      productName: string
      genderName: string | null
      colorName: string | null
      sizes: { sizeName: string; quantity: number }[]
      quantity: number
      usdUnitPrice: number
      vesUnitPrice: number
      discountPercent: number
      usdLineTotal: number
      vesLineTotal: number
      items: QuoteItem[]
    }

// Agrupa por talla las líneas de producto (no combos ni personalización) para pedidos grandes.
export function groupQuoteItemsBySize(items: QuoteItem[]): QuoteDisplayRow[] {
  const rows: QuoteDisplayRow[] = []
  const groups = new Map<string, Extract<QuoteDisplayRow, { kind: "group" }>>()
  for (const item of items) {
    if (item.parentId) continue
    const groupable = item.kind === "product" && item.sizeName && item.customizations.length === 0
    if (!groupable) {
      rows.push({ kind: "line", item })
      continue
    }
    const key = [item.productName, item.genderName ?? "", item.colorName ?? "", item.usdUnitPrice, item.vesUnitPrice, item.discountPercent].join("|")
    const group = groups.get(key)
    if (group) {
      group.items.push(item)
      group.quantity += item.quantity
      group.usdLineTotal += item.usdLineTotal
      group.vesLineTotal += item.vesLineTotal
      continue
    }
    const created: Extract<QuoteDisplayRow, { kind: "group" }> = {
      kind: "group",
      key,
      productName: item.productName,
      genderName: item.genderName,
      colorName: item.colorName,
      sizes: [],
      quantity: item.quantity,
      usdUnitPrice: item.usdUnitPrice,
      vesUnitPrice: item.vesUnitPrice,
      discountPercent: item.discountPercent,
      usdLineTotal: item.usdLineTotal,
      vesLineTotal: item.vesLineTotal,
      items: [item],
    }
    groups.set(key, created)
    rows.push(created)
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => (a.sizeSort ?? 0) - (b.sizeSort ?? 0))
    group.sizes = group.items.map((i) => ({ sizeName: i.sizeName ?? "", quantity: i.quantity }))
    group.usdLineTotal = Math.round(group.usdLineTotal * 100) / 100
    group.vesLineTotal = Math.round(group.vesLineTotal * 100) / 100
  }
  // Un grupo de una sola talla se muestra como línea normal.
  return rows.map((row) => (row.kind === "group" && row.items.length === 1 ? { kind: "line", item: row.items[0] } : row))
}
