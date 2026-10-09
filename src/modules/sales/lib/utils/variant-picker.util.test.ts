import { describe, expect, it } from "vitest"

import { changeSelection, initialSelection, type PickableVariant, variantChoices } from "./variant-picker.util"

const v = (id: string, gender: PickableVariant["gender"], color: string | null, size: string | null): PickableVariant => ({
  id,
  gender,
  color: color ? { name: color, sort: color === "Negro" ? 1 : 2 } : null,
  size: size ? { name: size, sort: ["S", "M", "L", "3XL"].indexOf(size) } : null,
})

// Caballero en negro y blanco (S–3XL); dama solo en negro (S–L).
const FILIPINA = [
  v("cn-s", "men", "Negro", "S"),
  v("cn-m", "men", "Negro", "M"),
  v("cn-3xl", "men", "Negro", "3XL"),
  v("cb-m", "men", "Blanco", "M"),
  v("dn-s", "women", "Negro", "S"),
  v("dn-l", "women", "Negro", "L"),
]

describe("elegir variante con botones", () => {
  it("ofrece los géneros, los colores del género y las tallas del género y el color", () => {
    expect(variantChoices(FILIPINA, { gender: null, color: null, size: null })).toMatchObject({ genders: ["women", "men"], colors: [], sizes: [], variant: null })
    expect(variantChoices(FILIPINA, { gender: "men", color: null, size: null })).toMatchObject({ colors: ["Negro", "Blanco"], sizes: [] })
    expect(variantChoices(FILIPINA, { gender: "men", color: "Negro", size: null })).toMatchObject({ sizes: ["S", "M", "3XL"], variant: null })
    expect(variantChoices(FILIPINA, { gender: "men", color: "Negro", size: "3XL" }).variant?.id).toBe("cn-3xl")
  })

  it("lo único de cada fila queda elegido solo", () => {
    expect(initialSelection(FILIPINA)).toEqual({ gender: null, color: null, size: null })
    // Dama: solo negro.
    expect(changeSelection(FILIPINA, { gender: null, color: null, size: null }, { gender: "women" })).toEqual({ gender: "women", color: "Negro", size: null })
    // Sin género ni color (p. ej. un gorro de talla única): la única variante.
    const gorro = [v("g", null, null, null)]
    expect(initialSelection(gorro)).toEqual({ gender: null, color: null, size: null })
    expect(variantChoices(gorro, initialSelection(gorro)).variant?.id).toBe("g")
  })

  it("al cambiar el género o el color se borra lo que ya no existe", () => {
    // Caballero 3XL negro → dama: la 3XL no existe en dama.
    expect(changeSelection(FILIPINA, { gender: "men", color: "Negro", size: "3XL" }, { gender: "women" })).toEqual({ gender: "women", color: "Negro", size: null })
    // Caballero M negro → blanco: la M sí existe en blanco (y es la única).
    expect(changeSelection(FILIPINA, { gender: "men", color: "Negro", size: "S" }, { color: "Blanco" })).toEqual({ gender: "men", color: "Blanco", size: "M" })
  })
})
