import { describe, expect, it } from "vitest"

import { fetchDolarApiRates } from "@/modules/treasury/lib/services/dolar-api.service"

const responses: Record<string, unknown> = {
  "/dolares/oficial": { promedio: 857.8876, fechaActualizacion: "2026-09-29T00:00:00-04:00" },
  "/euros/oficial": { promedio: 974.71473336, fechaActualizacion: "2026-09-29T00:00:00-04:00" },
  "/dolares/paralelo": { promedio: 958.580188, fechaActualizacion: "2026-09-29T21:01:15.541Z" },
}

const fakeFetch = (overrides: Record<string, unknown> = {}, status = 200) => async (url: string) => {
  const path = url.replace("https://ve.dolarapi.com/v1", "")
  return new Response(JSON.stringify({ ...responses, ...overrides }[path]), { status })
}

describe("DolarAPI", () => {
  it("lee BCV USD, BCV EUR y paralelo con la fecha del BCV (Caracas)", async () => {
    expect(await fetchDolarApiRates(fakeFetch())).toEqual({
      rateDate: "2026-09-29",
      bcvUsd: 857.8876,
      bcvEur: 974.71473336,
      parallelUsd: 958.580188,
    })
  })
  it("rechaza respuestas inválidas", async () => {
    await expect(
      fetchDolarApiRates(fakeFetch({ "/dolares/paralelo": { promedio: null, fechaActualizacion: "x" } }))
    ).rejects.toThrow(/inesperada/)
  })
  it("rechaza errores HTTP", async () => {
    await expect(fetchDolarApiRates(fakeFetch({}, 503))).rejects.toThrow(/503/)
  })
})
