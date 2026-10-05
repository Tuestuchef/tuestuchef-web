import { describe, expect, it } from "vitest"

import {
  formatPhone,
  formatTaxId,
  normalizeEmail,
  normalizeIdDocument,
  normalizeInstagram,
  normalizePhone,
} from "./normalize-contact.util"

describe("normalizePhone", () => {
  it.each([
    ["0414-123.45.67", "+584141234567"],
    ["0414 1234567", "+584141234567"],
    ["4141234567", "+584141234567"],
    ["58 414 1234567", "+584141234567"],
    ["+58 (414) 123-4567", "+584141234567"],
    ["0212-5551234", "+582125551234"],
    ["+1 305 555 1234", "+13055551234"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it("vacío es null e inválido es undefined", () => {
    expect(normalizePhone("  ")).toBeNull()
    expect(normalizePhone("12345")).toBeUndefined()
    expect(normalizePhone("+58 999 1234567")).toBeUndefined()
  })
})

describe("normalizeEmail", () => {
  it("pasa a minúsculas y valida", () => {
    expect(normalizeEmail("  Ana@Correo.COM ")).toBe("ana@correo.com")
    expect(normalizeEmail("")).toBeNull()
    expect(normalizeEmail("sin-arroba")).toBeUndefined()
  })
})

describe("normalizeInstagram", () => {
  it.each([
    ["@Luis.Chef", "luis.chef"],
    ["https://www.instagram.com/luis_chef/?hl=es", "luis_chef"],
    ["instagram.com/x", "x"],
    ["dos palabras", undefined],
  ])("%s → %s", (input, expected) => {
    expect(normalizeInstagram(input)).toBe(expected)
  })
})

describe("normalizeIdDocument", () => {
  it.each([
    ["V-12.345.678", "V12345678"],
    ["12345678", "V12345678"],
    ["e 8.123.456", "E8123456"],
    ["J-40123456-7", "J401234567"],
    ["X123", undefined],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeIdDocument(input)).toBe(expected)
  })
})

describe("formatPhone", () => {
  it("formatea números venezolanos", () => {
    expect(formatPhone("+584141234567")).toBe("0414-123.45.67")
    expect(formatPhone("+13055551234")).toBe("+13055551234")
  })
})

describe("formatTaxId", () => {
  it("separa el dígito verificador del RIF", () => {
    expect(formatTaxId("J123456789")).toBe("J-12345678-9")
  })

  it("una cédula queda con guion", () => {
    expect(formatTaxId("V12345678")).toBe("V-12345678")
  })
})
