import { describe, expect, it } from "vitest"

import { decideRateSync } from "@/modules/treasury/lib/utils/rate-sync.util"

const fetched = { rateDate: "2026-09-29", bcvUsd: 857.8876, bcvEur: 974.7147, parallelUsd: 958.5802 }
const TODAY = "2026-09-30"
const api = {
  source: "api" as const,
  bcv_usd: 857.8876,
  bcv_eur: 974.7147,
  binance_usdt: 958.5802,
  created_at: "2026-09-30T10:00:00Z",
}

describe("sincronización de tasas", () => {
  it("día sin tasas: se guarda", () => {
    expect(decideRateSync([], fetched, TODAY)).toBe("insert")
  })
  it("ya corregida a mano: no se pisa", () => {
    expect(decideRateSync([{ ...api, source: "manual" }, api], fetched, TODAY)).toBe("skip_manual")
  })
  it("corrección manual de ayer no bloquea la de hoy", () => {
    expect(
      decideRateSync([{ ...api, source: "manual", created_at: "2026-09-29T15:00:00Z" }], fetched, TODAY)
    ).toBe("insert")
  })
  it("misma tasa automática: no se duplica", () => {
    expect(decideRateSync([api], fetched, TODAY)).toBe("skip_same")
  })
  it("misma tasa pero guardada otro día (el BCV no publicó): se guarda la de hoy", () => {
    expect(decideRateSync([{ ...api, created_at: "2026-09-30T03:58:00Z" }], fetched, TODAY)).toBe("insert")
  })
  it("la tasa cambió: se guarda la nueva", () => {
    expect(decideRateSync([{ ...api, binance_usdt: 950 }], fetched, TODAY)).toBe("insert")
  })
})
