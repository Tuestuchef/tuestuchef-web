import { describe, expect, it } from "vitest"

import { caracasNoonIso, formatDate, formatDayHeading, toCaracasDate } from "./format-date.util"

describe("formatDate", () => {
  it("una fecha sola es ese mismo día en Caracas", () => {
    expect(formatDate("2026-10-10")).toBe(formatDate(caracasNoonIso("2026-10-10")))
    expect(formatDate("2026-10-10")).toMatch(/^10 /)
    expect(formatDayHeading("2026-10-10")).toMatch(/10/)
  })

  it("un instante se muestra en hora de Caracas", () => {
    // 02:00 UTC del 10 es todavía el 9 en Caracas.
    expect(formatDate("2026-10-10T02:00:00Z")).toMatch(/^9 /)
    expect(toCaracasDate("2026-10-10T02:00:00Z")).toBe("2026-10-09")
  })
})
