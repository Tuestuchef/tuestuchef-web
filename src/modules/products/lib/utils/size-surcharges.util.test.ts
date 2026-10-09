import { describe, expect, it } from "vitest"

import { cellKey, cumulativeSurcharges, initialCells } from "./size-surcharges.util"

const SIZES = ["xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"]

describe("precio por talla", () => {
  it("el atajo suma el monto por cada talla desde la elegida (acumulado)", () => {
    expect(cumulativeSurcharges(SIZES, "3xl", 3)).toEqual({ "3xl": 3, "4xl": 6, "5xl": 9, "6xl": 12 })
    expect(cumulativeSurcharges(SIZES, "6xl", 4.5)).toEqual({ "6xl": 4.5 })
    expect(cumulativeSurcharges(SIZES, "otra", 3)).toEqual({})
    expect(cumulativeSurcharges(SIZES, "3xl", 0)).toEqual({})
  })

  it("cada celda toma el recargo de su género o, si no tiene, el de todos", () => {
    const rows = [
      { sizeId: "3xl", gender: null, amountUsd: 2 },
      { sizeId: "3xl", gender: "men" as const, amountUsd: 3 },
      { sizeId: "6xl", gender: "women" as const, amountUsd: 5 },
    ]
    expect(initialCells(rows, ["3xl", "6xl"], ["women", "men"])).toEqual({
      [cellKey("3xl", "women")]: 2,
      [cellKey("3xl", "men")]: 3,
      [cellKey("6xl", "women")]: 5,
    })
    // Sin géneros: una sola columna, la de todos.
    expect(initialCells(rows, ["3xl"], [null])).toEqual({ [cellKey("3xl", null)]: 2 })
  })
})
