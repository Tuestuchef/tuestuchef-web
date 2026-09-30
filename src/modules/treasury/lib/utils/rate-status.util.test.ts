import { describe, expect, it } from "vitest"

import { isRateCurrent } from "@/modules/treasury/lib/utils/rate-status.util"

describe("tasa vigente para hoy", () => {
  it("fecha BCV de hoy", () => {
    expect(isRateCurrent({ rate_date: "2026-09-30", created_at: "2026-09-29T20:00:00Z" }, "2026-09-30")).toBe(true)
  })
  it("fecha BCV de ayer pero guardada hoy (fin de semana, DolarAPI atrasada)", () => {
    expect(isRateCurrent({ rate_date: "2026-09-29", created_at: "2026-09-30T10:05:00Z" }, "2026-09-30")).toBe(true)
  })
  it("guardada anoche a las 23:58 de Caracas cuenta como de ayer", () => {
    expect(isRateCurrent({ rate_date: "2026-09-29", created_at: "2026-09-30T03:58:38Z" }, "2026-09-30")).toBe(false)
  })
  it("sin tasa", () => {
    expect(isRateCurrent(null, "2026-09-30")).toBe(false)
  })
})
