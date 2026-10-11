import { describe, expect, it } from "vitest"

import { normalizeSearch, searchList } from "./search.util"

const items = ["Filipina Dama Negra 3XL", "Filipina Caballero Blanca M", "Delantal Pechera Negro"].map((name) => ({
  item: name,
  haystack: normalizeSearch(name),
}))

describe("búsqueda", () => {
  it("todas las palabras, en cualquier orden, sin acentos ni mayúsculas", () => {
    expect(searchList(items, "negra filipina", 10).matches).toEqual(["Filipina Dama Negra 3XL"])
    expect(searchList(items, "NEGR", 10).matches).toHaveLength(2)
    expect(normalizeSearch("Pechéra")).toBe("pechera")
  })

  it("corta en el límite pero cuenta todas", () => {
    expect(searchList(items, "", 2)).toEqual({ matches: items.slice(0, 2).map((i) => i.item), total: 3 })
  })
})
