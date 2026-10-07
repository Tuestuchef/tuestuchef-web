import { describe, expect, it } from "vitest"

import { comboExtraUsd, comboSurcharges, shortNames } from "./combo.util"

describe("combos", () => {
  it("suma el recargo de cada pieza elegida por su cantidad", () => {
    const extras: Record<string, number> = { fil3xl: 3, jog3xl: 2, filM: 0 }
    expect(
      comboExtraUsd(
        [
          { variantId: "fil3xl", quantity: 2 },
          { variantId: "filM", quantity: 1 },
          { variantId: "jog3xl", quantity: 1 },
        ],
        (id) => extras[id]
      )
    ).toBe(8)
    expect(comboExtraUsd([{ variantId: "otro", quantity: 1 }], () => undefined)).toBe(0)
  })

  it("los recargos del combo suman los de sus piezas; en cada componente, el más alto", () => {
    const surcharges: Record<string, { id: string; name: string; amountUsd: number }[]> = {
      boton: [{ id: "3xl", name: "3XL", amountUsd: 3 }],
      cierre: [
        { id: "3xl", name: "3XL", amountUsd: 4 },
        { id: "pdg", name: "Pata de gallo", amountUsd: 2 },
      ],
      jogger: [{ id: "3xl", name: "3XL", amountUsd: 2 }],
    }
    expect(
      comboSurcharges(
        [
          { quantity: 1, productIds: ["boton", "cierre"] },
          { quantity: 2, productIds: ["recto", "jogger"] },
        ],
        (id) => surcharges[id] ?? []
      )
    ).toEqual([
      // Filipina: el más alto (cierre, 4) + 2 pantalones × 2.
      { id: "3xl", name: "3XL", amountUsd: 8 },
      { id: "pdg", name: "Pata de gallo", amountUsd: 2 },
    ])
  })

  it("acorta los nombres de productos parecidos", () => {
    expect(shortNames(["Filipina manga corta botón", "Filipina manga corta cierre", "Filipina manga corta broche"])).toEqual([
      "botón",
      "cierre",
      "broche",
    ])
    expect(shortNames(["Pantalón recto", "Pantalón jogger"])).toEqual(["recto", "jogger"])
    // Sin palabras en común, o uno solo: tal cual.
    expect(shortNames(["Gorro", "Delantal"])).toEqual(["Gorro", "Delantal"])
    expect(shortNames(["Filipina"])).toEqual(["Filipina"])
    // Nunca deja un nombre vacío.
    expect(shortNames(["Filipina", "Filipina dama"])).toEqual(["Filipina", "Filipina dama"])
  })
})
