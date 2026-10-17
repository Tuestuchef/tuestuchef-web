import { describe, expect, it } from "vitest"

import type { SellableVariant } from "../types/sales.types"
import { methodsForCustomer, variantsForCustomer } from "./agreement-pricing.util"

const variant = (id: string, productId: string, extra = 0, exclusive: string | null = null): SellableVariant => ({
  id,
  productId,
  sku: id,
  productName: productId,
  variantLabel: "",
  gender: null,
  color: null,
  size: null,
  fulfillmentType: "stock",
  stock: 10,
  pricesUsd: { cash: 20 + extra, zelle: 22 + extra },
  extraUsd: extra,
  exclusiveCustomerId: exclusive,
})

const variants = [variant("a", "fixed", 3), variant("b", "percent"), variant("c", "plain"), variant("d", "school-only", 0, "school")]
const agreement = {
  customerId: "school",
  customerName: "Escuela",
  generalDiscountPercent: 5,
  vesRateKind: "bcv_usd" as const,
  notes: null,
  rules: [
    { productId: "fixed", discountPercent: null, fixedPriceUsd: 12 },
    { productId: "percent", discountPercent: 25, fixedPriceUsd: null },
  ],
}

describe("precios del acuerdo en pantalla (igual que la base)", () => {
  it("fijo en cualquier método más el recargo; % sobre el precio del método; % general", () => {
    const priced = variantsForCustomer(variants, "school", agreement, ["cash", "zelle", "usdt"])
    const byId = new Map(priced.map((v) => [v.id, v]))
    expect(byId.get("a")!.pricesUsd).toEqual({ cash: 15, zelle: 15, usdt: 15 })
    expect(byId.get("b")!.pricesUsd).toEqual({ cash: 15, zelle: 16.5 })
    expect(byId.get("c")!.pricesUsd).toEqual({ cash: 19, zelle: 20.9 })
    expect(byId.has("d")).toBe(true)
  })

  it("los exclusivos solo se ven con su cliente; sin acuerdo, precios normales", () => {
    expect(variantsForCustomer(variants, null, null, []).map((v) => v.id)).toEqual(["a", "b", "c"])
    expect(variantsForCustomer(variants, "other", null, [])[1].pricesUsd).toEqual({ cash: 20, zelle: 22 })
  })
})

describe("tasa euro del cliente", () => {
  const methods = [
    { id: "pm", rateKind: "bcv_usd" as const, currency: "VES" as const },
    { id: "eur", rateKind: "bcv_eur" as const, currency: "VES" as const },
    { id: "cash", rateKind: "none" as const, currency: "USD" as const },
  ]
  it("con euro, los métodos en Bs pasan a la BCV euro; USD no cambia", () => {
    expect(methodsForCustomer(methods, { ...agreement, vesRateKind: "bcv_eur" }).map((m) => m.rateKind)).toEqual(["bcv_eur", "bcv_eur", "none"])
  })
  it("sin acuerdo o con dólar, todo queda igual", () => {
    expect(methodsForCustomer(methods, null)).toBe(methods)
    expect(methodsForCustomer(methods, agreement)).toBe(methods)
  })
})
