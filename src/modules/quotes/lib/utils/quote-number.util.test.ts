import { describe, expect, it } from "vitest"

import { formatQuoteNumber } from "./quote-number.util"

describe("formatQuoteNumber", () => {
  it("rellena con ceros según el relleno configurado", () => {
    expect(formatQuoteNumber("TLT", 5, 1)).toBe("TLT00001")
    expect(formatQuoteNumber("TLT", 5, 123456)).toBe("TLT123456")
  })

  it("agrega la versión desde la segunda", () => {
    expect(formatQuoteNumber("TLT", 5, 42, 1)).toBe("TLT00042")
    expect(formatQuoteNumber("TLT", 5, 42, 2)).toBe("TLT00042-v2")
  })
})
