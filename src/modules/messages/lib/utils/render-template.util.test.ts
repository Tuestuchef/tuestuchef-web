import { describe, expect, it } from "vitest"

import type { SaleDetail } from "@/modules/sales/lib/types/sales.types"

import { refundText } from "./message-values.util"
import { renderTemplate, unknownPlaceholders, whatsappLink } from "./render-template.util"

describe("renderTemplate", () => {
  it("completa los datos y deja vacío lo que no tiene valor", () => {
    expect(renderTemplate("Hola {cliente}, tu pedido {numero}{extra}.", { cliente: "Ana", numero: "NE-000001" })).toBe("Hola Ana, tu pedido NE-000001.")
  })

  it("no deja más de una línea en blanco seguida", () => {
    expect(renderTemplate("A\n\n{detalle}\n\nB", { detalle: "" })).toBe("A\n\nB")
  })
})

describe("unknownPlaceholders", () => {
  it("encuentra datos que el mensaje no conoce", () => {
    expect(unknownPlaceholders("order_ready", "Hola {clinte}, {pendiente} {reembolso}")).toEqual(["clinte", "reembolso"])
    expect(unknownPlaceholders("order_cancelled", "{cliente} {reembolso}")).toEqual([])
  })
})

describe("whatsappLink", () => {
  it("usa el número sin + y codifica el texto", () => {
    expect(whatsappLink("Hola *Ana*\n¿listo?", "+584141111111")).toBe("https://wa.me/584141111111?text=Hola%20*Ana*%0A%C2%BFlisto%3F")
    expect(whatsappLink("Hola", null)).toBe("https://wa.me/?text=Hola")
  })
})

describe("refundText", () => {
  const sale = (payments: { currency: "VES" | "USD" | "USDT"; amount: number; usdtValue: number }[]) => ({ payments }) as unknown as SaleDetail

  it("devuelve cada moneda en la misma proporción", () => {
    const text = refundText(
      sale([
        { currency: "VES", amount: 4000, usdtValue: 80 },
        { currency: "USD", amount: 20, usdtValue: 20 },
      ]),
      50
    )
    expect(text).toBe("Bs 2.000,00 y $ 10,00")
  })

  it("sin reembolso, cero", () => {
    expect(refundText(sale([{ currency: "USD", amount: 20, usdtValue: 20 }]), 0)).toBe("$ 0,00")
  })
})
