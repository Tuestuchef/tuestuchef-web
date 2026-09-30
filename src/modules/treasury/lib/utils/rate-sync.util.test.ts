import { describe, expect, it } from "vitest"

import { decideRateSync } from "@/modules/treasury/lib/utils/rate-sync.util"

const fetched = { rateDate: "2026-09-29", bcvUsd: 857.8876, bcvEur: 974.7147, parallelUsd: 958.5802 }
const api = { source: "api" as const, bcv_usd: 857.8876, bcv_eur: 974.7147, binance_usdt: 958.5802 }

describe("sincronización de tasas", () => {
  it("día sin tasas: se guarda", () => {
    expect(decideRateSync([], fetched)).toBe("insert")
  })
  it("ya corregida a mano: no se pisa", () => {
    expect(decideRateSync([{ ...api, source: "manual" }, api], fetched)).toBe("skip_manual")
  })
  it("misma tasa automática: no se duplica", () => {
    expect(decideRateSync([api], fetched)).toBe("skip_same")
  })
  it("la tasa cambió: se guarda la nueva", () => {
    expect(decideRateSync([{ ...api, binance_usdt: 950 }], fetched)).toBe("insert")
  })
})
