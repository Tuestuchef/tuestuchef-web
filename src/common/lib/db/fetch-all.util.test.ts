import { describe, expect, it } from "vitest"

import { fetchAll } from "./fetch-all.util"

describe("fetchAll", () => {
  it("pide páginas de 1.000 hasta traer todas las filas", async () => {
    const all = Array.from({ length: 2345 }, (_, i) => i)
    const asked: [number, number][] = []
    const { data, error } = await fetchAll(async (from, to) => {
      asked.push([from, to])
      return { data: all.slice(from, to + 1), error: null }
    })
    expect(error).toBeNull()
    expect(data).toEqual(all)
    expect(asked).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it("con un error, se detiene y lo devuelve", async () => {
    const error = { message: "falló", details: "", hint: "", code: "500", name: "PostgrestError" } as never
    const result = await fetchAll(async (from) => (from === 0 ? { data: Array(1000).fill(1), error: null } : { data: null, error }))
    expect(result.error).toBe(error)
    expect(result.data).toHaveLength(1000)
  })
})
