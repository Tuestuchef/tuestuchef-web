import { describe, expect, it } from "vitest"

import { pickHistoricalRates } from "./rate-history.util"

const history = {
  // El BCV no publica el fin de semana (10 y 11).
  bcvUsd: [
    { date: "2026-10-08", value: 870 },
    { date: "2026-10-09", value: 875 },
    { date: "2026-10-12", value: 880 },
  ],
  bcvEur: [
    { date: "2026-10-08", value: 980 },
    { date: "2026-10-09", value: 982 },
    { date: "2026-10-12", value: 990 },
  ],
  parallelUsd: [
    { date: "2026-10-08", value: 1000 },
    { date: "2026-10-09", value: 1010 },
    { date: "2026-10-10", value: 1012 },
    { date: "2026-10-12", value: 1020 },
  ],
}

describe("tasas de un día pasado", () => {
  it("usa las del día cuando están", () => {
    expect(pickHistoricalRates("2026-10-09", history)).toEqual({
      bcvUsd: 875,
      bcvEur: 982,
      parallelUsd: 1010,
      estimated: false,
      parallelFrom: "2026-10-09",
    })
  })

  it("en fin de semana rige el último BCV publicado, sin ser estimada", () => {
    expect(pickHistoricalRates("2026-10-10", history)).toMatchObject({ bcvUsd: 875, bcvEur: 982, parallelUsd: 1012, estimated: false })
  })

  it("sin paralelo ese día, toma el más cercano con la misma brecha y la marca estimada", () => {
    // 11/10: el más cercano es el 10 (a igual distancia que el 12, gana el anterior). BCV igual → mismo valor.
    expect(pickHistoricalRates("2026-10-11", history)).toMatchObject({ parallelUsd: 1012, estimated: true, parallelFrom: "2026-10-10" })
    // 13/10: paralelo del 12 (1020) con BCV 880 → 880 → 1020.
    const later = { ...history, bcvUsd: [...history.bcvUsd, { date: "2026-10-13", value: 897.6 }] }
    expect(pickHistoricalRates("2026-10-13", later)).toMatchObject({ bcvUsd: 897.6, parallelUsd: 1040.4, estimated: true })
  })

  it("sin datos cerca de la fecha, no inventa", () => {
    expect(pickHistoricalRates("2026-01-01", history)).toBeNull()
  })
})
