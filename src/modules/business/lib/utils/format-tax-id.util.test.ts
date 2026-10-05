import { describe, expect, it } from "vitest"

import { formatTaxId } from "./format-tax-id.util"

describe("formatTaxId", () => {
  it("separa el dígito verificador del RIF", () => {
    expect(formatTaxId("J123456789")).toBe("J-12345678-9")
  })

  it("una cédula queda con guion", () => {
    expect(formatTaxId("V12345678")).toBe("V-12345678")
  })
})
