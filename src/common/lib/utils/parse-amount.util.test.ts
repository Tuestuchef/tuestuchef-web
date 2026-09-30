import { describe, expect, it } from "vitest"

import { parseAmount } from "@/common/lib/utils/parse-amount.util"

describe("parseAmount", () => {
  it.each([
    ["12", 12],
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234.567", 1234567],
    ["1.234.567,89", 1234567.89],
    [" 25 ", 25],
    ["0,01", 0.01],
    ["10.000", 10000],
    ["1.500", 1500],
    ["12,345", 12345],
    ["22000", 22000],
  ])("%s → %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it.each(["", "abc", "-5", "12,3456", "1,2,3.4.5", "12.", ",5", "1e3", "12,5.3,1"])(
    "%s → null",
    (input) => {
      expect(parseAmount(input)).toBeNull()
    }
  )

  it("en tasas, 3 dígitos tras el separador son decimales", () => {
    expect(parseAmount("36,5073", 8)).toBe(36.5073)
    expect(parseAmount("36.507", 8)).toBe(36.507)
  })
})
