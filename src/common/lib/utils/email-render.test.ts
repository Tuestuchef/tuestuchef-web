import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"

import DigestEmail from "@/modules/notifications/components/digest-email"
import QuoteEmail from "@/modules/quotes/components/quote-email"

// Resend convierte `react:` a HTML con @react-email/render (dependencia opcional suya). Si falta, cada
// envío falla con un 500: esta prueba lo detecta antes.
describe("correos", () => {
  it("el del presupuesto se convierte a HTML", async () => {
    const html = await render(
      createElement(QuoteEmail, {
        siteUrl: "https://example.com",
        companyName: "Tuestuchef",
        customerName: "Restaurante La Sazón",
        code: "TLT00002",
        total: "$ 150,80",
        validUntil: "12/10/2026",
        note: "Gracias por tu interés.",
        link: "https://example.com/p/presupuesto/abc",
        sender: { name: "Ana Pérez", phone: null, email: "ana@example.com" },
      })
    )
    expect(html).toContain("TLT00002")
    expect(html).toContain("Ver presupuesto")
  })

  it("el resumen de avisos se convierte a HTML", async () => {
    const html = await render(createElement(DigestEmail, { name: "Ana", dateLabel: "5 de octubre", sections: [], siteUrl: "https://example.com" }))
    expect(html).toContain("Ana")
  })
})
