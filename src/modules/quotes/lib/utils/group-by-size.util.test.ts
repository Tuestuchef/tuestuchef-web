import { describe, expect, it } from "vitest"

import type { QuoteItem } from "../types/quotes.types"
import { groupQuoteItemsBySize } from "./group-by-size.util"

const item = (over: Partial<QuoteItem>): QuoteItem => ({
  id: crypto.randomUUID(),
  parentId: null,
  kind: "product",
  variantId: "v",
  productName: "Filipina",
  sku: "FIL",
  colorName: "Blanco",
  sizeName: "M",
  sizeSort: 2,
  quantity: 1,
  discountPercent: 0,
  usdUnitPrice: 25,
  vesUnitPrice: 28,
  usdLineTotal: 25,
  vesLineTotal: 28,
  customizations: [],
  ...over,
})

describe("groupQuoteItemsBySize", () => {
  it("junta tallas del mismo producto, color y precio, ordenadas por talla", () => {
    const rows = groupQuoteItemsBySize([
      item({ sizeName: "L", sizeSort: 3, quantity: 5, usdLineTotal: 125 }),
      item({ sizeName: "S", sizeSort: 1, quantity: 3, usdLineTotal: 75 }),
      item({ productName: "Delantal", sizeName: null, quantity: 2, usdLineTotal: 30 }),
    ])
    expect(rows).toHaveLength(2)
    const group = rows[0]
    expect(group.kind).toBe("group")
    if (group.kind !== "group") return
    expect(group.sizes).toEqual([
      { sizeName: "S", quantity: 3 },
      { sizeName: "L", quantity: 5 },
    ])
    expect(group).toMatchObject({ quantity: 8, usdLineTotal: 200 })
  })

  it("no agrupa líneas con personalización ni de otro color o precio", () => {
    const rows = groupQuoteItemsBySize([
      item({ sizeName: "S" }),
      item({ sizeName: "M", colorName: "Negro" }),
      item({ sizeName: "L", usdUnitPrice: 30 }),
    ])
    expect(rows.every((r) => r.kind === "line")).toBe(true)
  })
})
